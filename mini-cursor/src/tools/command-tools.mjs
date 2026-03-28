import { spawn } from 'node:child_process';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * execute_command — 执行系统命令（捕获输出返回给 Agent）
 *
 * 与旧版的区别：不再用 stdio: 'inherit' 直接输出到控制台，
 * 而是捕获 stdout/stderr 返回给 Agent，让 Agent 能"看到"命令结果。
 */
export const executeCommandTool = tool(
    async ({ command, workingDirectory }) => {
        const cwd = workingDirectory || process.cwd();
        const timeout = 30_000; // 30 秒超时

        return new Promise((resolve) => {
            const child = spawn(command, {
                cwd,
                shell: true,
                timeout,
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                resolve(`命令执行出错: ${error.message}`);
            });

            child.on('close', (code) => {
                // 截断过长的输出
                const maxLen = 8000;
                if (stdout.length > maxLen) {
                    stdout = stdout.slice(0, maxLen) + `\n...(输出已截断，共 ${stdout.length} 字符)`;
                }
                if (stderr.length > maxLen) {
                    stderr = stderr.slice(0, maxLen) + `\n...(错误输出已截断，共 ${stderr.length} 字符)`;
                }

                let result = '';

                if (code === 0) {
                    result = `命令执行成功（退出码 0）`;
                    if (stdout) result += `\n\n标准输出:\n${stdout}`;
                    if (stderr) result += `\n\n标准错误:\n${stderr}`;
                } else {
                    result = `命令执行失败（退出码 ${code}）`;
                    if (stdout) result += `\n\n标准输出:\n${stdout}`;
                    if (stderr) result += `\n\n标准错误:\n${stderr}`;
                }

                if (workingDirectory) {
                    result += `\n\n（命令在目录 "${workingDirectory}" 中执行）`;
                }

                resolve(result);
            });
        });
    },
    {
        name: 'execute_command',
        description: '执行系统命令并返回输出结果。支持指定工作目录，有 30 秒超时限制',
        schema: z.object({
            command: z.string().describe('要执行的命令'),
            workingDirectory: z.string().optional().describe('工作目录（可选，默认为当前目录）'),
        }),
    }
);
