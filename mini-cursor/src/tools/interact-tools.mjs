import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import chalk from 'chalk';
import { rl } from '../rl.mjs';

/**
 * ask_user — Human-in-the-loop (HITL) 交互工具
 *
 * 当 Agent 遇到需求模糊、缺少前置参数、或者打算执行高风险操作时，
 * 主动通过系统终端挂起执行并询问用户。获得回答后，再将用户的回答反馈给 Agent 参考。
 */
export const askUserTool = tool(
    async ({ question }) => {
        // 强制终端换行，确保 UI 清晰
        console.log('\n' + chalk.bgMagenta.white.bold(' ⏸️ 暂停: Agent 需要您的帮助 '));

        try {
            // 阻塞性提问（利用全局单例，不会重复捕捉控制台，也不会 close stdout）
            const answer = await rl.question(chalk.magenta(`🤖 提问: ${question}\n`) + chalk.bold.green('> '));
            console.log(chalk.gray('▶️ 恢复执行...\n'));
            return `用户的回复: ${answer}`;
        } catch (err) {
            return `尝试获取用户输入失败: ${err.message}`;
        }
    },
    {
        name: 'ask_user',
        description: '当用户的需求不明确、需要人类确认某项操作、或者需要关键参数时调用此工具向用户提问。Agent 会暂停等待用户在控制台输入答案。',
        schema: z.object({
            question: z.string().describe('你需要向用户询问的具体问题，务必详细说明你为什么停下来以及你需要什么信息。'),
        }),
    }
);
