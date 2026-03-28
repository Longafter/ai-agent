import fs from 'node:fs/promises';
import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * search_code — 递归搜索目录中包含指定文本的文件
 *
 * 纯 Node.js 实现，不依赖 grep/ripgrep 等外部工具。
 * 返回匹配的文件名、行号、行内容。
 */
export const searchCodeTool = tool(
    async ({ directory, query, filePattern }) => {
        try {
            const results = [];
            const maxResults = 50; // 防止结果过多

            await searchDir(directory, query, filePattern, results, maxResults);

            if (results.length === 0) {
                return `在 ${directory} 中未找到包含 "${query}" 的文件`;
            }

            const output = results
                .map((r) => `${r.file}:${r.line}: ${r.content}`)
                .join('\n');

            const truncated = results.length >= maxResults ? `\n\n（结果已截断，仅显示前 ${maxResults} 条匹配）` : '';

            return `搜索 "${query}" 的结果（${results.length} 条匹配）:\n${output}${truncated}`;
        } catch (error) {
            return `搜索失败: ${error.message}`;
        }
    },
    {
        name: 'search_code',
        description: '在指定目录中递归搜索包含指定文本的代码文件，返回匹配的文件名、行号和内容',
        schema: z.object({
            directory: z.string().describe('要搜索的目录路径'),
            query: z.string().describe('要搜索的文本内容'),
            filePattern: z.string().optional().describe('可选，文件名过滤（如 *.mjs、*.js），默认搜索所有文本文件'),
        }),
    }
);

// 跳过的目录
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next',
    '__pycache__', '.venv', 'venv', '.cache',
]);

// 常见文本文件扩展名
const TEXT_EXTENSIONS = new Set([
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
    '.json', '.md', '.txt', '.yaml', '.yml',
    '.html', '.css', '.scss', '.less',
    '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h',
    '.sh', '.bat', '.ps1',
    '.vue', '.svelte',
    '.toml', '.ini', '.cfg', '.env',
    '.xml', '.svg',
]);

/**
 * 递归搜索目录
 */
async function searchDir(dir, query, filePattern, results, maxResults) {
    if (results.length >= maxResults) return;

    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return; // 跳过无权限的目录
    }

    for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) {
                await searchDir(fullPath, query, filePattern, results, maxResults);
            }
            continue;
        }

        // 文件名过滤
        if (filePattern) {
            if (!matchPattern(entry.name, filePattern)) continue;
        } else {
            // 默认只搜索文本文件
            const ext = path.extname(entry.name).toLowerCase();
            if (!TEXT_EXTENSIONS.has(ext)) continue;
        }

        // 搜索文件内容
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (results.length >= maxResults) break;
                if (lines[i].includes(query)) {
                    results.push({
                        file: fullPath,
                        line: i + 1,
                        content: lines[i].trim(),
                    });
                }
            }
        } catch {
            // 跳过无法读取的文件（二进制等）
        }
    }
}

/**
 * 简单的 glob 模式匹配（支持 *.ext 格式）
 */
function matchPattern(filename, pattern) {
    if (pattern.startsWith('*.')) {
        return filename.endsWith(pattern.slice(1));
    }
    return filename === pattern;
}
