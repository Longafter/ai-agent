import 'dotenv/config';
import {
  RunnableLambda,
  RunnableSequence,
  RunnablePassthrough,
  RunnableBranch,
} from '@langchain/core/runnables';

// ============================================
// 演示：用最简单的方式理解 agentStepChain 的数据流
// ============================================

console.log('\n========================================');
console.log('演示1: RunnableSequence 基本数据流');
console.log('========================================\n');

// 模拟 state 对象
const mockState = {
  count: 0,
  name: '初始状态',
};

// 步骤1: 给 count 加 1
const step1 = RunnableLambda.from((input) => {
  console.log('📍 step1 收到的 input:', input);
  const output = { ...input, count: input.count + 1 };
  console.log('📍 step1 输出的 output:', output);
  return output;
});

// 步骤2: 修改 name
const step2 = RunnableLambda.from((input) => {
  console.log('📍 step2 收到的 input:', input);
  const output = { ...input, name: '经过 step2' };
  console.log('📍 step2 输出的 output:', output);
  return output;
});

// 步骤3: 再给 count 加 1
const step3 = RunnableLambda.from((input) => {
  console.log('📍 step3 收到的 input:', input);
  const output = { ...input, count: input.count + 1 };
  console.log('📍 step3 输出的 output:', output);
  return output;
});

const sequence = RunnableSequence.from([step1, step2, step3]);

console.log('🚀 初始 state:', mockState);
console.log('---');
const result1 = await sequence.invoke(mockState);
console.log('---');
console.log('✅ 最终结果:', result1);

// ============================================
console.log('\n========================================');
console.log('演示2: RunnablePassthrough.assign 数据流');
console.log('========================================\n');

const originalData = {
  messages: ['用户消息'],
  done: false,
};

console.log('🚀 初始数据:', originalData);
console.log('---');

// assign 会：1. 保留原数据  2. 添加新字段
const assignStep = RunnablePassthrough.assign({
  response: RunnableLambda.from((input) => {
    console.log('📍 assign 内部收到的 input:', input);
    console.log('📍 assign 内部将返回一个新值作为 response');
    return '这是 LLM 的回复';
  }),
});

const result2 = await assignStep.invoke(originalData);
console.log('---');
console.log('✅ assign 后的结果:', result2);
console.log('   注意: messages 和 done 还在，新增了 response');

// ============================================
console.log('\n========================================');
console.log('演示3: RunnableBranch 数据流');
console.log('========================================\n');

const branchInput = { value: 10, label: '测试' };
console.log('🚀 初始数据:', branchInput);
console.log('---');

const branch = RunnableBranch.from([
  // 分支1: value > 5
  [
    (state) => {
      console.log('📍 检查分支1条件: state.value > 5 ?', state.value > 5);
      return state.value > 5;
    },
    RunnableLambda.from((state) => {
      console.log('📍 执行分支1处理');
      return { ...state, result: '大于5' };
    }),
  ],
  // 默认分支
  RunnableLambda.from((state) => {
    console.log('📍 执行默认分支');
    return { ...state, result: '其他情况' };
  }),
]);

const result3 = await branch.invoke(branchInput);
console.log('---');
console.log('✅ branch 后的结果:', result3);

// ============================================
console.log('\n========================================');
console.log('演示4: 模拟 agentStepChain 的完整流程 (有工具调用)');
console.log('========================================\n');

// 模拟初始 state
const agentState = {
  messages: ['用户: 北京南站附近的酒店'],
  done: false,
  tools: ['maps_search', 'maps_direction'],
};

console.log('🚀 初始 agentState:', agentState);
console.log('\n========== 开始执行 agentStepChain ==========\n');

// 模拟 LLM 返回（有工具调用）
const mockLLMResponse = {
  content: '',
  tool_calls: [{ name: 'maps_search', args: { query: '北京南站酒店' } }],
};

// 模拟工具执行器
const mockToolExecutor = RunnableLambda.from((input) => {
  console.log('📍📍📍 toolExecutor 收到的 input:');
  console.log('   - input.response:', input.response);
  console.log('   - input.tools:', input.tools);
  console.log('📍📍📍 toolExecutor 执行工具并返回结果');
  return ['ToolMessage: 酒店A, 酒店B, 酒店C'];
});

// 完整的 agentStepChain
const agentStepChain = RunnableSequence.from([
  // ===== 步骤1: 调用 LLM，添加 response =====
  RunnablePassthrough.assign({
    response: RunnableLambda.from((input) => {
      console.log('📌 步骤1 - 调用 LLM');
      console.log('   收到的 input:', input);
      console.log('   返回 mockLLMResponse');
      return mockLLMResponse;
    }),
  }),

  // ===== 步骤2: 根据是否有 tool_calls 分支 =====
  RunnableBranch.from([
    // 分支1: 无工具调用
    [
      (state) => {
        const hasNoTools =
          !state.response?.tool_calls ||
          state.response.tool_calls.length === 0;
        console.log(
          '📌 步骤2 - 检查分支1条件: 无工具调用?',
          hasNoTools,
        );
        return hasNoTools;
      },
      RunnableLambda.from((state) => {
        console.log('📌 执行分支1: 无工具调用，返回最终结果');
        return {
          ...state,
          done: true,
          final: state.response.content,
        };
      }),
    ],

    // 默认分支: 有工具调用
    RunnableSequence.from([
      // 2.1: 添加 response 到 messages
      RunnableLambda.from((state) => {
        console.log('📌 步骤2.1 - 默认分支: 有工具调用');
        console.log('   收到的 state 包含:');
        console.log('   - messages:', state.messages);
        console.log('   - response:', state.response);
        console.log('   - tools:', state.tools);
        return {
          ...state,
          messages: [...state.messages, 'AIMessage'],
        };
      }),
      // 2.2: 执行工具
      RunnablePassthrough.assign({
        toolMessages: mockToolExecutor,
      }),
      // 2.3: 合并结果
      RunnableLambda.from((state) => {
        console.log('📌 步骤2.3 - 合并 toolMessages 到 messages');
        console.log('   收到的 state.toolMessages:', state.toolMessages);
        return {
          ...state,
          messages: [...state.messages, ...state.toolMessages],
          done: false,
        };
      }),
    ]),
  ]),
]);

const result4 = await agentStepChain.invoke(agentState);
console.log('\n========== agentStepChain 执行完毕 ==========\n');
console.log('✅ 最终结果:');
console.log('   - messages:', result4.messages);
console.log('   - done:', result4.done);
if (result4.final) {
  console.log('   - final:', result4.final);
}

// ============================================
console.log('\n========================================');
console.log('演示5: 模拟 agentStepChain (无工具调用)');
console.log('========================================\n');

const agentState2 = {
  messages: ['用户: 你好'],
  done: false,
  tools: ['maps_search'],
};

const mockLLMResponse2 = {
  content: '你好！有什么可以帮助你的？',
  tool_calls: [], // 无工具调用
};

const agentStepChain2 = RunnableSequence.from([
  RunnablePassthrough.assign({
    response: RunnableLambda.from((input) => {
      console.log('📌 调用 LLM，返回 mockLLMResponse2');
      return mockLLMResponse2;
    }),
  }),

  RunnableBranch.from([
    [
      (state) => {
        const hasNoTools =
          !state.response?.tool_calls ||
          state.response.tool_calls.length === 0;
        console.log('📌 检查分支1条件: 无工具调用?', hasNoTools);
        return hasNoTools;
      },
      RunnableLambda.from((state) => {
        console.log('📌 执行分支1: 返回最终结果');
        return {
          ...state,
          done: true,
          final: state.response.content,
        };
      }),
    ],
    RunnableLambda.from((state) => {
      console.log('📌 执行默认分支');
      return { ...state, done: false };
    }),
  ]),
]);

console.log('🚀 初始 agentState:', agentState2);
console.log('---');
const result5 = await agentStepChain2.invoke(agentState2);
console.log('---');
console.log('✅ 最终结果:');
console.log('   - done:', result5.done);
console.log('   - final:', result5.final);
