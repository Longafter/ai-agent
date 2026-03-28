function fibonacciRecursive(n) {
    if (n <= 1) {
        return n;
    }
    return fibonacciRecursive(n - 1) + fibonacciRecursive(n - 2);
}

function fibonacciIterative(n) {
    if (n <= 1) {
        return n;
    }
    let prev = 0;
    let curr = 1;
    for (let i = 2; i <= n; i++) {
        const next = prev + curr;
        prev = curr;
        curr = next;
    }
    return curr;
}

function fibonacciDP(n) {
    if (n <= 1) {
        return n;
    }
    const dp = [0, 1];
    for (let i = 2; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    return dp[n];
}

function* fibonacciGenerator() {
    let prev = 0;
    let curr = 1;
    yield prev;
    yield curr;
    while (true) {
        const next = prev + curr;
        prev = curr;
        curr = next;
        yield next;
    }
}

function getFibonacciSequence(n) {
    const sequence = [];
    const gen = fibonacciGenerator();
    for (let i = 0; i < n; i++) {
        sequence.push(gen.next().value);
    }
    return sequence;
}

function test() {
    console.log('=== 斐波那契数列测试 ===\n');

    const testCases = [0, 1, 2, 5, 10, 20];

    console.log('测试单个值：');
    testCases.forEach(n => {
        const result1 = fibonacciRecursive(n);
        const result2 = fibonacciIterative(n);
        const result3 = fibonacciDP(n);
        console.log(`F(${n}) = ${result1} (递归) = ${result2} (迭代) = ${result3} (动态规划)`);
    });

    console.log('\n测试前 15 个斐波那契数：');
    const sequence = getFibonacciSequence(15);
    console.log(sequence.join(', '));

    console.log('\n使用生成器获取前 10 个数：');
    const gen = fibonacciGenerator();
    const first10 = [];
    for (let i = 0; i < 10; i++) {
        first10.push(gen.next().value);
    }
    console.log(first10.join(', '));
}

test();

export {
    fibonacciRecursive,
    fibonacciIterative,
    fibonacciDP,
    fibonacciGenerator,
    getFibonacciSequence
};
