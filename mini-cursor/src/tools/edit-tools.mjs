import fs from 'node:fs/promises';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * edit_file — 精确编辑文件（替换片段而非全量覆写）
 *
 * 核心设计：用 oldContent 精确匹配文件中的片段，替换为 newContent。
 * 这比 write_file 全量覆写更安全，更节省 token。
 */
export const editFileTool = tool(
    async ({ filePath, oldContent, newContent }) => {
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');

            // 检查 oldContent 是否存在于文件中
            if (!fileContent.includes(oldContent)) {
                // 提供有用的错误信息，帮助 Agent 纠正
                const lines = fileContent.split('\n');
                const preview = lines.length > 20
                    ? lines.slice(0, 20).join('\n') + `\n... (共 ${lines.length} 行)`
                    : fileContent;
                return `编辑失败：在文件 ${filePath} 中找不到要替换的内容。\n\n请确认 oldContent 与文件内容完全一致（包括空格和缩进）。\n\n文件前 20 行预览:\n${preview}`;
            }

            // 检查匹配次数
            const matchCount = fileContent.split(oldContent).length - 1;

            // 执行替换（只替换第一个匹配）
            const updatedContent = fileContent.replace(oldContent, newContent);
            await fs.writeFile(filePath, updatedContent, 'utf-8');

            const info = matchCount > 1
                ? `（注意：文件中有 ${matchCount} 处匹配，仅替换了第 1 处）`
                : '';

            return `编辑成功: ${filePath} ${info}`;
        } catch (error) {
            return `编辑文件失败: ${error.message}`;
        }
    },
    {
        name: 'edit_file',
        description: '精确编辑已有文件：将 oldContent（必须与文件中的内容完全一致）替换为 newContent。比 write_file 更安全，适合修改已有文件',
        schema: z.object({
            filePath: z.string().describe('要编辑的文件路径'),
            oldContent: z.string().describe('要被替换的原文内容（必须精确匹配文件中的文本，包括空格和缩进）'),
            newContent: z.string().describe('替换后的新内容'),
        }),
    }
);
