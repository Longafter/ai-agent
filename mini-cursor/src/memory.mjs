import { trimMessages } from '@langchain/core/messages';
import { getEncoding } from 'js-tiktoken';
import chalk from 'chalk';

// 最大 Token 限制 （若要测试截断功能，请将此值设为 100）
const MAX_TOKENS = 16000;
// 使用 OpenAI 的默认分词器
const encoder = getEncoding('cl100k_base');

/**
 * 计算消息数组的 token 数量
 */
export function countTokens(messages) {
    let total = 0;
    for (const msg of messages) {
        const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);
        total += encoder.encode(content).length;
    }
    return total;
}

/**
 * 记忆截断函数
 * 保留最近的对话历史，确保总 token 数量不超过 MAX_TOKENS
 */
export async function trimMemory(messages) {
    if (!messages || messages.length === 0) return messages;

    const originalCount = messages.length;
    const originalTokens = countTokens(messages);

    // 如果未超限，直接返回，优化性能
    if (originalTokens <= MAX_TOKENS) {
        return messages;
    }

    // 调用 langchain 的 trimMessages，保留最新的消息（strategy: 'last'）
    const trimmedMessages = await trimMessages(messages, {
        maxTokens: MAX_TOKENS,
        tokenCounter: async (msgs) => countTokens(msgs),
        strategy: 'last',
    });

    const trimmedTokens = countTokens(trimmedMessages);

    // 打印灰色的截断提示
    if (trimmedMessages.length < originalCount) {
        console.log(
            chalk.gray(
                `\n🧠 [记忆管理] 历史过长 (${originalTokens} tokens) > 限制值 ${MAX_TOKENS}。` +
                `已剔除早期对话，截断至最近 ${trimmedMessages.length} 条 (${trimmedTokens} tokens)。`
            )
        );
    }

    return trimmedMessages;
}
