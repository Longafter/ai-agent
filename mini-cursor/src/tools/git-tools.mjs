import { execSync } from 'node:child_process';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 封装 git 命令执行的通用辅助函数
 */
function runGit(args, cwd) {
    try {
        const result = execSync(`git ${args}`, {
            cwd: cwd || process.cwd(),
            encoding: 'utf-8',
            timeout: 10_000,
        });
        return result.trim();
    } catch (error) {
        // git 命令失败时仍然返回有用信息
        const stderr = error.stderr?.trim() || '';
        const stdout = error.stdout?.trim() || '';
        return `Git 命令失败（退出码 ${error.status}）\n${stderr || stdout || error.message}`;
    }
}

// ==================== git_status ====================

export const gitStatusTool = tool(
    async ({ workingDirectory }) => {
        const cwd = workingDirectory || process.cwd();
        const status = runGit('status --short', cwd);

        if (!status) {
            return '工作区干净，没有未提交的更改。';
        }

        // 附加分支信息
        const branch = runGit('branch --show-current', cwd);
        return `当前分支: ${branch}\n\n变更文件:\n${status}`;
    },
    {
        name: 'git_status',
        description: '查看 Git 仓库的当前状态（修改了哪些文件、是否有未暂存的更改等）',
        schema: z.object({
            workingDirectory: z.string().optional().describe('Git 仓库目录（可选，默认为当前工作目录）'),
        }),
    }
);

// ==================== git_diff ====================

export const gitDiffTool = tool(
    async ({ filePath, staged, workingDirectory }) => {
        const cwd = workingDirectory || process.cwd();

        let args = 'diff';
        if (staged) args += ' --staged';
        if (filePath) args += ` -- "${filePath}"`;

        const diff = runGit(args, cwd);

        if (!diff) {
            return staged
                ? '暂存区没有变更。'
                : '工作区没有未暂存的变更。';
        }

        // 截断过长的 diff 输出
        const maxLen = 6000;
        if (diff.length > maxLen) {
            return diff.slice(0, maxLen) + `\n\n...(diff 已截断，共 ${diff.length} 字符)`;
        }

        return diff;
    },
    {
        name: 'git_diff',
        description: '查看 Git 变更的详细内容（代码级别的增删改）。可以查看特定文件的变更，也可以查看暂存区的变更。',
        schema: z.object({
            filePath: z.string().optional().describe('要查看 diff 的具体文件路径（可选，默认查看所有变更）'),
            staged: z.boolean().optional().describe('是否只查看暂存区的变更（已 git add 的文件）'),
            workingDirectory: z.string().optional().describe('Git 仓库目录（可选）'),
        }),
    }
);

// ==================== git_log ====================

export const gitLogTool = tool(
    async ({ count, workingDirectory }) => {
        const cwd = workingDirectory || process.cwd();
        const n = count || 10;

        const log = runGit(`log --oneline --graph -n ${n}`, cwd);

        if (!log) {
            return '没有找到提交记录（仓库可能尚未初始化或为空）。';
        }

        return log;
    },
    {
        name: 'git_log',
        description: '查看 Git 提交历史记录（最近的 N 条提交）',
        schema: z.object({
            count: z.number().optional().describe('要显示的提交数量（默认 10 条）'),
            workingDirectory: z.string().optional().describe('Git 仓库目录（可选）'),
        }),
    }
);
