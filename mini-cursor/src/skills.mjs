import { promises as fs } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import matter from 'gray-matter';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const SKILLS_DIR_NAME = '.agents/skills';

/**
 * 内部辅助函数：获取全部技能入口文件的完整路径列表
 * 必须符合 Anthropic Agent Skills Open Standard，即每个技能是一个文件夹，内含 SKILL.md
 */
async function getMarkdownFiles(cwd) {
    const skillsDir = path.join(cwd, SKILLS_DIR_NAME);
    try {
        const stats = await fs.stat(skillsDir);
        if (!stats.isDirectory()) return [];

        // 读取技能目录下的所有子文件夹
        const entries = await fs.readdir(skillsDir, { withFileTypes: true });
        const skillDirs = entries.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

        const validSkillFiles = [];
        for (const dirName of skillDirs) {
            // 每项技能必须通过其目录下的 SKILL.md 暴露
            const skillFilePath = path.join(skillsDir, dirName, 'SKILL.md');
            try {
                const fileStat = await fs.stat(skillFilePath);
                if (fileStat.isFile()) {
                    validSkillFiles.push(skillFilePath);
                }
            } catch (e) {
                // 如果该文件夹下没有 SKILL.md，直接忽略
                continue;
            }
        }
        return validSkillFiles;
    } catch {
        return [];
    }
}

/**
 * [阶段一]：在 Agent 启动时调用，仅提取技能文件的 Metadata（不加载长文本正文）
 * 将被拼接到 System Prompt 末尾，成为技能引索。
 * @param {string} cwd - 当前工作目录
 * @returns {Promise<string>} 极简的目录文本
 */
export async function loadSkillsSummary(cwd = process.cwd()) {
    const filePaths = await getMarkdownFiles(cwd);
    if (filePaths.length === 0) return '';

    console.log(chalk.gray(`\n📚 正在扫描项目专属技能库...`));

    let summaryLines = [];
    for (const filePath of filePaths) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            // 只解析并丢弃长长的主体内容，提取前端 yaml
            const parsed = matter(content);
            const name = parsed.data.name;
            const desc = parsed.data.description;

            if (name) {
                summaryLines.push(`- **${name}** : ${desc || '无详细描述'}`);
                console.log(chalk.green(`  ✓ 发现技能项: ${name}`));
            }
        } catch (err) {
            console.log(chalk.yellow(`  ⚠️ 解析技能文件失败 (${path.basename(filePath)}): ${err.message}`));
        }
    }

    if (summaryLines.length === 0) return '';

    return `\n## 项目专属技能与规范手册 (Skills Directory)
当前项目包含以下业务规范，如果你即将进行的开发任务与以下条目相关，**你必须**优先使用 \`read_skill_manual\` 工具来查阅详细内容，然后再开始写代码：
${summaryLines.join('\n')}`;
}

/**
 * [阶段二]：Agent 主动调用的核心工具，用来展开阅读数百行的规则内容
 */
export const readSkillManualTool = tool(
    async ({ skill_name }) => {
        const filePaths = await getMarkdownFiles(process.cwd());

        for (const filePath of filePaths) {
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const parsed = matter(content);
                if (parsed.data.name === skill_name) {
                    // 只返回主体正文，去掉 yaml 头部
                    return `### 手册《${skill_name}》的完整内容如下：\n\n${parsed.content.trim()}`;
                }
            } catch {
                continue;
            }
        }

        return `⚠️ 错误: 找不到名为 "${skill_name}" 的技能说明书。请核对名称。`;
    },
    {
        name: 'read_skill_manual',
        description: '在编码前，阅读当前项目特定的工作规约或编码指南手册长文。',
        schema: z.object({
            skill_name: z.string().describe('你要查阅的技能规范的 name（从 System Prompt 名单中拷贝）'),
        }),
    }
);
