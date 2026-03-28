import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import {
    HumanMessage,
    SystemMessage,
    ToolMessage,
} from '@langchain/core/messages';
import chalk from 'chalk';
import ora from 'ora';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { saveSession, loadSession } from './session.mjs';

// 导入所有工具
import { readFileTool, writeFileTool, listDirectoryTool } from './tools/file-tools.mjs';
import { editFileTool } from './tools/edit-tools.mjs';
import { searchCodeTool } from './tools/search-tools.mjs';
import { executeCommandTool } from './tools/command-tools.mjs';
import { askUserTool } from './tools/interact-tools.mjs';
import { gitStatusTool, gitDiffTool, gitLogTool } from './tools/git-tools.mjs';

// 导入记忆管理模块
import { trimMemory, countTokens } from './memory.mjs';

// 导入 MCP 客户端工具加载器
import { loadMcpTools } from './mcp-client.mjs';

// 导入技能加载器及按需读取工具
import { loadSkillsSummary, readSkillManualTool } from './skills.mjs';

// ==================== 工具注册 ====================

const builtInTools = [
    readFileTool,
    writeFileTool,
    editFileTool,
    listDirectoryTool,
    searchCodeTool,
    executeCommandTool,
    askUserTool,
    gitStatusTool,
    gitDiffTool,
    gitLogTool,
    readSkillManualTool,
];

// 动态通过 MCP 协议加载外部工具（Top-Level Await）
const mcpTools = await loadMcpTools();

// 合并所有工具供 Agent 核心使用
const tools = [...builtInTools, ...mcpTools];

const SYSTEM_PROMPT_TEMPLATE = `你是一个强大的自主开发 Agent。
你的任务是协助人类完成任何编程、系统维护、文件处理等相关工作。

## 当前工作目录
${process.cwd()}

## 可用工具
1. **read_file** — 读取文件内容（带行号）
2. **write_file** — 创建新文件（自动建目录）
3. **edit_file** — 精确编辑已有文件（用 oldContent 匹配并替换为 newContent）
4. **list_directory** — 列出目录内容
5. **search_code** — 在目录中递归搜索代码
6. **execute_command** — 执行系统命令
7. **git_status** — 查看 Git 仓库状态（哪些文件被修改 / 暂存）
8. **git_diff** — 查看代码级别的变更详情
9. **git_log** — 查看最近的提交历史

## 工作原则
1. **先理解，再动手**：收到任务后，先用 list_directory 和 read_file 了解项目结构和相关代码，不要急着修改。
2. **精确编辑**：修改已有文件时，优先使用 edit_file（精确替换），而不是 write_file（全量覆写）。只有创建新文件才用 write_file。
3. **搜索优先**：需要定位代码时，用 search_code 搜索，而不是逐个文件阅读。
4. **逐步验证**：每完成一步修改后，用 read_file 或 execute_command 验证结果。
5. **不懂就问**：如果遇到需求描述模糊、核心业务逻辑缺失、或者试图执行大范围删除等高危重构操作时，**绝对不要瞎猜**，必须立即使用 ask_user 工具停下来向用户确认。
6. **Git 感知**：修改代码前，建议先用 git_status 查看当前仓库状态；修改完成后，用 git_diff 确认改动是否符合预期。
7. **简洁回复**：完成任务后，简要说明做了什么以及结果。

## edit_file 使用规范
- oldContent 必须与文件中的内容**完全一致**（包括空格、缩进、换行）
- 建议先 read_file 查看文件内容，再构造准确的 oldContent
- 如果匹配失败，工具会返回文件预览，帮你修正`;

// ==================== 模型 & Prompt ====================

let model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
    configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
    },
});

let modelWithTools = model.bindTools(tools);

// 配置 marked 使用终端渲染器
marked.setOptions({ renderer: new TerminalRenderer() });

// ==================== 原生辅助函数 ====================

/**
 * 工具执行器：遍历 tool_calls，逐个调用工具，返回 ToolMessage 数组
 */
async function executeTools(toolCalls) {
    const toolMessages = [];

    for (const toolCall of toolCalls ?? []) {
        const foundTool = tools.find((t) => t.name === toolCall.name);

        console.log(chalk.yellow(`  ▸ ${toolCall.name}(${formatArgs(toolCall.args)})`));

        if (!foundTool) {
            console.log(chalk.red(`  ✗ 未知工具: ${toolCall.name}`));
            toolMessages.push(
                new ToolMessage({ content: `未知工具: ${toolCall.name}`, tool_call_id: toolCall.id })
            );
            continue;
        }

        try {
            const result = await foundTool.invoke(toolCall.args);
            console.log(`  ◂ ${formatToolOutput(result)}`);
            toolMessages.push(
                new ToolMessage({ content: result, tool_call_id: toolCall.id })
            );
        } catch (error) {
            const errorMsg = `工具执行出错: ${error.message}`;
            console.log(chalk.red(`  ✗ ${errorMsg}`));
            toolMessages.push(
                new ToolMessage({ content: errorMsg, tool_call_id: toolCall.id })
            );
        }
    }

    return toolMessages;
}

// ==================== 主控核心 (ReAct) ====================

/**
 * 创建并返回 Agent 实例
 */
export async function createAgent() {
    // 启动时试着装载上次持久化的会话历史
    let history = await loadSession() || [];
    if (history.length > 0) {
        console.log('\n');
        console.log(chalk.gray(`  [Agent] 成功恢复 ${history.length} 条会话记忆。`));
    }

    return {
        /**
         * 执行一轮用户指令
         */
        async run(userInput, maxIterations = 30) {
            history.push(new HumanMessage(userInput));

            for (let i = 0; i < maxIterations; i++) {
                // ⭐ Spinner 动画替代静态文字
                const spinner = ora({
                    text: `思考中…（第 ${i + 1} 轮）`,
                    spinner: 'dots',
                    color: 'cyan',
                }).start();

                // 1. 内存截断
                const trimmedMessages = await trimMemory(history);
                const currentTokens = countTokens([new SystemMessage(currentSystemPrompt), ...trimmedMessages]);
                spinner.text = `思考中… [Token: ${currentTokens} / 16000]`;

                // 2. 流式获取 LLM 响应（含工具调用解析）
                const response = await streamAndParseLLMResponse(
                    modelWithTools,
                    currentSystemPrompt,
                    trimmedMessages,
                    spinner
                );

                // 将助手的响应加入历史
                history.push(response);

                // 3. 判断处理分支
                if (!response.tool_calls || response.tool_calls.length === 0) {
                    // 没有需要调用的工具 -> 回复用户
                    console.log(chalk.green(`\n✨ Agent 回复：\n`));
                    const rendered = marked(response.content || '');
                    process.stdout.write(rendered);
                    await saveSession(history);
                    return response.content;
                }

                // 需要调用工具
                console.log(
                    chalk.blue(`🔧 调用 ${response.tool_calls.length} 个工具: `) +
                    chalk.cyan(response.tool_calls.map((t) => t.name).join(', '))
                );
                if (response.content) console.log(chalk.gray(response.content));

                // 4. 执行工具
                const toolMessages = await executeTools(response.tool_calls);
                history.push(...toolMessages);
            }

            console.log(chalk.red(`\n⚠️ 达到最大迭代次数（${maxIterations}），强制停止`));
            await saveSession(history);
            return history[history.length - 1].content;
        },

        /**
         * 清空对话历史
         */
        clear: async () => {
            currentSystemPrompt = await buildSystemPrompt();
            history = [];
            await saveSession(history);
            console.log(chalk.gray('  [Agent] 记忆已清空。'));
        },

        /**
         * 获取当前 Agent 状态（会话长度，预估 Token）
         */
        getStatus: () => {
            const currentTokens = countTokens([new SystemMessage(currentSystemPrompt), ...history]);
            return {
                messageCount: history.length,
                tokens: currentTokens
            };
        },

        /**
         * 智能上下文摘要与压缩
         */
        compact: async () => {
            if (history.length <= 1) {
                console.log(chalk.gray('  [Agent] 当前历史记录太短，无需压缩。'));
                return;
            }

            const spinner = ora({ text: '正在向 AI 请求压缩与提炼历史上下文...', color: 'cyan' }).start();

            try {
                // 使用原模型（不绑定工具）进行精简总结
                const compactPrompt = new SystemMessage(
                    `请对我们的对话历史进行高度技术化提炼。你需要输出一段精简的摘要，重点保留：\n1. 核心业务上下文\n2. 已经执行过的关键操作\n3. 已知但未解决的问题\n4. 用户的核心诉求与进展。`
                );
                const response = await model.invoke([compactPrompt, ...history]);

                // 将精简后的摘要作为第一条人类输入放回历史，清空冗余步骤
                const summaryMsg = new HumanMessage(`[系统保留上下文摘要]\n${response.content}`);
                history = [summaryMsg];
                await saveSession(history);

                spinner.succeed(chalk.green('上下文记录已成功压缩提炼！'));
                const currentTokens = countTokens([new SystemMessage(currentSystemPrompt), ...history]);
                console.log(chalk.gray(`  └─ 当前占用: ${currentTokens} / 16000 Tokens`));

            } catch (error) {
                spinner.fail(chalk.red(`上下文压缩失败: ${error.message}`));
            }
        },

        /**
         * 热切换模型
         */
        setModel: (newModelName) => {
            model = new ChatOpenAI({
                modelName: newModelName,
                apiKey: process.env.OPENAI_API_KEY,
                temperature: 0,
                configuration: {
                    baseURL: process.env.OPENAI_BASE_URL,
                },
            });
            modelWithTools = model.bindTools(tools);
            process.env.MODEL_NAME = newModelName;
            console.log(chalk.green(`  [Agent] 已成功切换后端模型为: ${newModelName}`));
        },
    };
}

// ==================== 辅助函数 ====================

async function buildSystemPrompt() {
    let prompt = SYSTEM_PROMPT_TEMPLATE;
    const skillsSummary = await loadSkillsSummary();

    // 如果存在技能目录说明，仅将其摘要注入到尾部
    if (skillsSummary) {
        prompt += `\n${skillsSummary}`;
    }

    return prompt;
}

// 初始化时立刻构建带有技能的初始 Prompt 占位，避免同步死锁
let currentSystemPrompt = await buildSystemPrompt();

function formatArgs(args) {
    if (!args) return '';
    return Object.entries(args)
        .map(([key, value]) => {
            const str = String(value);
            const display = str.length > 60 ? str.slice(0, 60) + '...' : str;
            return `${key}: "${display}"`;
        })
        .join(', ');
}

/**
 * 格式化并给工具调用的文本返回值着色 (支持基础的 Diff 着色)
 */
function formatToolOutput(text) {
    if (!text || typeof text !== 'string') return String(text);

    // 预览限制放大到 1000 字符，能让我们在终端看到更多的上下文
    const isTruncated = text.length > 1000;
    const previewText = isTruncated ? text.slice(0, 1000) : text;

    const lines = previewText.split('\n');
    const coloredLines = lines.map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) return chalk.green(line);
        if (line.startsWith('-') && !line.startsWith('---')) return chalk.red(line);
        if (line.startsWith('@@ ')) return chalk.cyan(line);
        return chalk.gray(line);
    });

    let result = coloredLines.join('\n  ◂ ');
    if (isTruncated) {
        result += chalk.gray(`\n  ◂ ... (共 ${text.length} 字符)`);
    }
    return result;
}

// ==================== 辅助流解析函数 ====================
/**
 * 专门处理 LLM 的流式响应：将文字打屏，同时拼接好被拆碎的 tool_call_chunks
 */
async function streamAndParseLLMResponse(model, systemPrompt, trimmedMessages, spinner) {
    const messages = [new SystemMessage(systemPrompt), ...trimmedMessages];
    const stream = await model.stream(messages);

    let fullContent = '';
    let toolCalls = [];
    let isFirstTextChunk = true;

    for await (const chunk of stream) {
        // 处理文本内容：逐字流式输出
        if (chunk.content) {
            if (isFirstTextChunk && spinner) {
                spinner.stop();
                isFirstTextChunk = false;
            }
            process.stdout.write(chalk.white(chunk.content));
            fullContent += chunk.content;
        }

        // 处理工具调用：累积 tool_call chunks
        if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
            for (const tc of chunk.tool_call_chunks) {
                const existing = toolCalls.find(t => t.index === tc.index);
                if (existing) {
                    existing.args = (existing.args || '') + (tc.args || '');
                } else {
                    toolCalls.push({ ...tc, args: tc.args || '' });
                }
            }
        }
    }

    if (fullContent && !isFirstTextChunk) {
        process.stdout.write('\n');
    }
    if (spinner && spinner.isSpinning) {
        spinner.stop();
    }

    // 解析工具调用参数
    const parsedToolCalls = toolCalls.map(tc => {
        let parsedArgs = {};
        try { parsedArgs = JSON.parse(tc.args || '{}'); } catch { parsedArgs = {}; }
        return { name: tc.name, args: parsedArgs, id: tc.id };
    }).filter(tc => tc.name);

    // 构建并返回完整的 AIMessage
    const { AIMessage } = await import('@langchain/core/messages');
    return new AIMessage({
        content: fullContent,
        tool_calls: parsedToolCalls,
    });
}
