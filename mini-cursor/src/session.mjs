import fs from 'fs/promises';
import path from 'path';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

const SESSION_FILE = path.resolve(process.cwd(), '.mc-session.json');

/**
 * 序列化并保存会话历史记录到本地文件
 */
export async function saveSession(history) {
    try {
        const serialized = history.map(msg => {
            const type = msg._getType(); // 返回 'human', 'ai', 'system', 'tool'
            return {
                type,
                content: msg.content,
                tool_calls: msg.tool_calls,
                tool_call_id: msg.tool_call_id
            };
        });
        await fs.writeFile(SESSION_FILE, JSON.stringify(serialized, null, 2), 'utf8');
    } catch (error) {
        // 静默处理保存失败，例如权限问题
    }
}

/**
 * 启动时尝试读取本地历史记录还原 Langchain 消息实例
 */
export async function loadSession() {
    try {
        const data = await fs.readFile(SESSION_FILE, 'utf8');
        const serialized = JSON.parse(data);

        const history = serialized.map(msg => {
            if (msg.type === 'human') return new HumanMessage({ content: msg.content });
            if (msg.type === 'system') return new SystemMessage({ content: msg.content });
            if (msg.type === 'ai') return new AIMessage({ content: msg.content, tool_calls: msg.tool_calls });
            if (msg.type === 'tool') return new ToolMessage({ content: msg.content, tool_call_id: msg.tool_call_id });
            return null;
        }).filter(Boolean);

        return history;
    } catch (error) {
        // 文件不存在或解析失败，视为无记忆
        return null;
    }
}
