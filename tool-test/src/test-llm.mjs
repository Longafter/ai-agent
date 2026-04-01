import { OpenAI } from 'openai';

const client = new OpenAI({
  apiKey: 'sk-fyqjwyjggtifxclioowehmenenkxbuukfifvqrlnbnuflbpq',
  baseURL: 'https://api.siliconflow.cn/v1',
});

async function main() {
  const completion = await client.chat.completions.create({
    model: 'Pro/zai-org/GLM-5',
    messages: [
      {
        role: 'user',
        content: 'AI 时代人类最极致的剥削是什么？',
      },
    ],
  });
  console.log(completion.choices[0].message.content);
}

main();
