import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

let mcpClient = null;

/**
 * 加载 MCP 工具
 * @returns {Promise<Array>} 返回第三方 MCP Server 提供的一组工具
 */
export async function loadMcpTools() {
    try {
        const configPath = path.resolve(process.cwd(), 'mcp.config.json');

        // 尝试读取配置
        let configData;
        try {
            configData = await fs.readFile(configPath, 'utf8');
        } catch (err) {
            // 文件不存在，直接返回空工具列表
            if (err.code === 'ENOENT') {
                return [];
            }
            throw err;
        }

        const config = JSON.parse(configData);

        // 如果没有配置任何服务器，则返回空
        if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
            return [];
        }

        console.log(chalk.gray(`\n📡 正在连接第三方 MCP Servers...`));

        // 实例化客户端并获取工具
        mcpClient = new MultiServerMCPClient(config);
        const tools = await mcpClient.getTools();

        console.log(chalk.green(`  ✓ 成功加载 ${tools.length} 个 MCP 工具`));
        return tools;

    } catch (error) {
        console.error(chalk.red(`⚠️ 加载 MCP 工具失败: ${error.message}`));
        return [];
    }
}

/**
 * 关闭所有 MCP 连接
 */
export async function closeMcpClient() {
    if (mcpClient) {
        try {
            await mcpClient.close();
        } catch (error) {
            console.error(chalk.red(`⚠️ 关闭 MCP Client 失败: ${error.message}`));
        }
    }
}
