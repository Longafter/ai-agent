// STDIO 通信演示 - 修复版
import { spawn } from 'child_process';

console.log('🔌 STDIO 通信演示\n');

// 子进程代码
const childScript = `
process.stdin.on('data', (data) => {
  const input = data.toString().trim();
  console.log('子进程收到:', input);
  
  if (input === 'hello') {
    process.stdout.write('你好，我是子进程！\\n');
  } else if (input === 'tools') {
    process.stdout.write('可用工具: query_user, get_data\\n');
  } else if (input === 'exit') {
    process.stdout.write('子进程退出\\n');
    process.exit(0);
  } else {
    process.stdout.write('未知命令: ' + input + '\\n');
  }
});

console.log('子进程已启动，等待输入...');
`;

// 启动子进程
const child = spawn('node', ['-e', childScript], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// 监听子进程的输出
child.stdout.on('data', (data) => {
  console.log('📥 子进程回复:', data.toString().trim());
});

// 演示通信
setTimeout(() => {
  console.log('📤 发送: hello');
  child.stdin.write('hello\n');
}, 500);

setTimeout(() => {
  console.log('📤 发送: tools');
  child.stdin.write('tools\n');
}, 1500);

setTimeout(() => {
  console.log('📤 发送: exit');
  child.stdin.write('exit\n');
}, 2500);

setTimeout(() => {
  child.kill();
  console.log('🏁 演示结束');
}, 3500);