import 'dotenv/config';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import chalk from 'chalk';
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 连接 Python MCP Server
const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    'python-mcp-server': {
      command: 'python',
      args: ['E:\\ai-agent\\tool-test\\src\\my-mcp-server.py'],
    },
  },
});

const tools = await mcpClient.getTools();

console.log(chalk.bgYellow('📋 已发现工具列表:'));
tools.forEach((tool) => {
  console.log(chalk.cyan(`  - ${tool.name}: ${tool.description}`));
});

const modelWithTools = model.bindTools(tools);

async function runAgentWithTools(query, maxIterations = 10) {
  const messages = [new HumanMessage(query)];

  for (let i = 0; i < maxIterations; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...`));
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    // 检查是否有工具调用
    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    console.log(
      chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`),
    );
    console.log(
      chalk.bgBlue(
        `🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(', ')}`,
      ),
    );

    // 执行工具调用
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        console.log(chalk.magenta(`📞 调用工具 ${toolCall.name}，参数:`));
        console.log(chalk.magenta(JSON.stringify(toolCall.args, null, 2)));

        const toolResult = await foundTool.invoke(toolCall.args);

        let contentStr;
        if (typeof toolResult === 'string') {
          contentStr = toolResult;
        } else if (toolResult && toolResult.text) {
          contentStr = toolResult.text;
        }

        console.log(chalk.green(`✅ 工具返回结果:`));
        console.log(chalk.green(contentStr));

        messages.push(
          new ToolMessage({
            content: contentStr,
            tool_call_id: toolCall.id,
          }),
        );
      }
    }
  }

  return messages[messages.length - 1].content;
}

// 测试查询用户
console.log(chalk.bgCyan('\n🧪 测试 Python MCP Server 跨语言通信\n'));
await runAgentWithTools('查一下用户 001 的信息');

await mcpClient.close();
