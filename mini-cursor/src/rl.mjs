import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const commands = ['/help', '/status', '/compact', '/model', '/clear', '/exit'];

function completer(line) {
    // 仅当用户输入以 '/' 开头时触发命令补全
    if (line.startsWith('/')) {
        const hits = commands.filter((c) => c.startsWith(line));
        // 如果有匹配项则返回，没有则返回所有命令供选择
        return [hits.length ? hits : commands, line];
    }
    // 未输入 '/'，不进行补全
    return [[], line];
}

// 全局单例的 readline 接口，增加 completer 支持自动补全
export const rl = readline.createInterface({ input, output, completer });
