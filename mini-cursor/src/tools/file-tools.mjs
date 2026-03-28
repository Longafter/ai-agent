import fs from 'node:fs/promises';
import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * read_file — 读取文件内容（带行号）
 */
export const readFileTool = tool(
  async ({ filePath }) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      // 添加行号，方便 Agent 定位代码
      const numbered = content
        .split('\n')
        .map((line, i) => `${i + 1}: ${line}`)
        .join('\n');
      return `文件 ${filePath}（共 ${content.split('\n').length} 行）:\n${numbered}`;
    } catch (error) {
      return `读取文件失败: ${error.message}`;
    }
  },
  {
    name: 'read_file',
    description: '读取指定路径的文件内容，返回带行号的内容',
    schema: z.object({
      filePath: z.string().describe('文件的绝对路径或相对路径'),
    }),
  }
);

/**
 * write_file — 创建/覆写文件（自动创建目录）
 */
export const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return `文件写入成功: ${filePath}（${content.length} 字节）`;
    } catch (error) {
      return `写入文件失败: ${error.message}`;
    }
  },
  {
    name: 'write_file',
    description: '创建或覆写文件，自动创建父目录。适用于创建新文件，如需修改已有文件请用 edit_file',
    schema: z.object({
      filePath: z.string().describe('文件路径'),
      content: z.string().describe('要写入的完整文件内容'),
    }),
  }
);

/**
 * list_directory — 列出目录内容（含类型和大小）
 */
export const listDirectoryTool = tool(
  async ({ directoryPath }) => {
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      const details = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(directoryPath, entry.name);
          if (entry.isDirectory()) {
            return `📁 ${entry.name}/`;
          }
          try {
            const stat = await fs.stat(fullPath);
            const size = stat.size < 1024
              ? `${stat.size}B`
              : stat.size < 1024 * 1024
                ? `${(stat.size / 1024).toFixed(1)}KB`
                : `${(stat.size / (1024 * 1024)).toFixed(1)}MB`;
            return `📄 ${entry.name} (${size})`;
          } catch {
            return `📄 ${entry.name}`;
          }
        })
      );
      return `目录 ${directoryPath}（${entries.length} 个条目）:\n${details.join('\n')}`;
    } catch (error) {
      return `列出目录失败: ${error.message}`;
    }
  },
  {
    name: 'list_directory',
    description: '列出指定目录下的所有文件和文件夹，显示类型和大小',
    schema: z.object({
      directoryPath: z.string().describe('目录路径'),
    }),
  }
);
