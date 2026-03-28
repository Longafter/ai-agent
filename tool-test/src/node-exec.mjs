import { spawn } from 'node:child_process';
import { platform } from 'node:os';

// 跨平台命令
const isWindows = platform() === 'win32';

const command = isWindows
  ? '(echo. & echo n & echo.) | pnpm create vite react-todo-app --template react-ts'
  : 'echo -e "n\\nn" | pnpm create vite react-todo-app --template react-ts';

// const command = isWindows ? 'dir /b' : 'ls -la';

const cwd = process.cwd();

const child = spawn(command, {
  cwd,
  stdio: 'inherit', // 实时输出到控制台
  shell: true,
});

let errorMsg = '';

child.on('error', (error) => {
  errorMsg = error.message;
});

child.on('close', (code) => {
  // console.log(`子进程退出，退出码: ${code}`);
  if (code === 0) {
    process.exit(0);
  } else {
    if (errorMsg) {
      console.error(`错误: ${errorMsg}`);
    }
    process.exit(code || 1);
  }
});
