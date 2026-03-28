#!/usr/bin/env node
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { createAgent } from './agent.mjs';
import { rl } from './rl.mjs';
import { closeMcpClient } from './mcp-client.mjs';

// 创建 Agent 实例 (加载历史记忆)
const agent = await createAgent();

// 监听 Ctrl+C / readline 关闭，优雅退出
rl.on('close', async () => {
    console.log(chalk.gray('\n👋 再见！'));
    await closeMcpClient();
    process.exit(0);
});

console.log(chalk.bold.cyan('\n🤖 mini-cursor'));
console.log(chalk.gray('────────────────────────────────'));
console.log(chalk.gray('输入你的开发任务，Agent 会自动分析、搜索、编辑代码。'));
console.log(chalk.gray('支持直接使用 @文件名 预载入文本，例如：解释一下 @package.json'));
console.log(chalk.gray('特殊命令：/help 帮助 | /status 状态 | /exit 退出 | /clear 清空'));
console.log(chalk.gray('────────────────────────────────\n'));

/**
 * 交互式 REPL 循环
 */
async function prompt() {
    while (true) {
        try {
            const input = await rl.question(chalk.bold.green('> '));
            const trimmed = input.trim();

            // 空输入
            if (!trimmed) {
                continue;
            }

            // 特殊命令
            if (trimmed === '/exit') {
                await closeMcpClient();
                rl.close();
                return;
            }

            if (trimmed === '/clear') {
                agent.clear();
                continue;
            }

            if (trimmed === '/compact') {
                await agent.compact();
                continue;
            }

            if (trimmed === '/help') {
                console.log(chalk.cyan(`
可用命令：
  /help    - 显示此帮助信息
  /status  - 显示当前会话的状态（消息数、Token 用量）
  /compact - 智能压缩并总结目前的上下文记录
  /model   - 动态切换使用的模型，格式：/model <model_name>
  /clear   - 清空当前上下文记忆
  /exit    - 退出 mini-cursor

高级用法：
  @文件名   - 在输入中包含文件内容。例如: "解释一下 @src/agent.mjs 的作用"
                `));
                continue;
            }

            if (trimmed === '/status') {
                const status = agent.getStatus();
                console.log(chalk.cyan(`
📊 当前会话状态:
  历史记录 : ${status.messageCount} 条对话
  预估耗用 : ${status.tokens} / 16000 Tokens
                `));
                continue;
            }

            if (trimmed.startsWith('/model ')) {
                const newModel = trimmed.replace('/model ', '').trim();
                if (newModel) {
                    agent.setModel(newModel);
                } else {
                    console.log(chalk.red(`⚠️ 请提供模型名称，例如: /model gpt-4o-mini`));
                }
                continue;
            }

            // 处理 @mention 文件包含
            let finalInput = trimmed;
            const mentionRegex = /@([^\s]+)/g;
            let match;
            const attachedFiles = [];

            while ((match = mentionRegex.exec(trimmed)) !== null) {
                const filePath = match[1];
                try {
                    const resolvedPath = path.resolve(process.cwd(), filePath);
                    const stats = await fs.stat(resolvedPath);
                    if (stats.isFile()) {
                        const content = await fs.readFile(resolvedPath, 'utf8');
                        attachedFiles.push({ path: filePath, content });
                    }
                } catch (e) {
                    // 文件不存在或不可读，忽略（也许用户只是输入了一个邮箱地址或 @user）
                }
            }

            if (attachedFiles.length > 0) {
                console.log(chalk.gray(`📎 已自动附加 ${attachedFiles.length} 个文件内容:`));
                attachedFiles.forEach(f => console.log(chalk.gray(`  - ${f.path}`)));

                finalInput += '\n\n<attached_files>\n';
                attachedFiles.forEach(f => {
                    finalInput += `--- ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\`\n\n`;
                });
                finalInput += '</attached_files>';
            }

            // 执行 Agent
            await agent.run(finalInput);

        } catch (error) {
            if (error.message.includes('readline was closed')) {
                return;
            }
            console.log(chalk.red(`\n❌ 出错: ${error.message}\n`));
        }

        console.log(); // 空行分隔
    }
}

prompt();
