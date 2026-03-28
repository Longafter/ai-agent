import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

// 定义一个简单的工具
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市的天气',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称',
          },
        },
        required: ['city'],
      },
    },
  },
];

const modelWithTools = model.bindTools(tools);

async function test() {
  console.log(`测试模型: ${process.env.MODEL_NAME}`);
  console.log('API Base:', process.env.OPENAI_BASE_URL);
  console.log('\n发送消息: "北京今天天气怎么样？"\n');

  try {
    const response = await modelWithTools.invoke([
      new HumanMessage('北京今天天气怎么样？'),
    ]);

    console.log('响应内容:', response.content);
    console.log('\n工具调用:', JSON.stringify(response.tool_calls, null, 2));
    console.log('\nadditional_kwargs:', JSON.stringify(response.additional_kwargs, null, 2));

    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log('\n✅ 模型支持工具调用！');
    } else {
      console.log('\n❌ 模型没有返回工具调用，可能不支持工具调用功能');
    }
  } catch (error) {
    console.error('错误:', error.message);
  }
}

test();
