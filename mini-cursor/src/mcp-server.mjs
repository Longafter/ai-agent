import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 导入 mini-cursor 的所有核心工具
import { readFileTool, writeFileTool, listDirectoryTool } from './tools/file-tools.mjs';
import { editFileTool } from './tools/edit-tools.mjs';
import { searchCodeTool } from './tools/search-tools.mjs';
import { executeCommandTool } from './tools/command-tools.mjs';
import { gitStatusTool, gitDiffTool, gitLogTool } from './tools/git-tools.mjs';

const server = new McpServer({
    name: 'mini-cursor',
    version: '1.0.0',
});

// 不暴露 ask_user，因为它是需要终端 readline 支持的交互工具
const toolsToExpose = [
    readFileTool,
    writeFileTool,
    editFileTool,
    listDirectoryTool,
    searchCodeTool,
    executeCommandTool,
    gitStatusTool,
    gitDiffTool,
    gitLogTool,
];

// 遍历注册 LangChain 工具到 MCP Server
for (const tool of toolsToExpose) {
    server.registerTool(
        tool.name,
        {
            description: tool.description,
            // Langchain 里的 tool.schema 通常是一个 z.object(...)
            // MCP 的 registerTool 第二个参数要求 inputSchema 传入对应的 shape 对象
            inputSchema: tool.schema.shape,
        },
        async (args) => {
            try {
                const result = await tool.invoke(args);
                return {
                    content: [{ type: 'text', text: String(result) }]
                };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `执行工具时出错: ${error.message}` }],
                    isError: true
                };
            }
        }
    );
}

// 启动基于 Stdio 的 MCP 传输层
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('mini-cursor MCP Server is running on stdio transport.');
