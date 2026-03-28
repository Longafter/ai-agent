import 'dotenv/config';
import 'cheerio';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const cheerioLoader = new CheerioWebBaseLoader(
  'https://juejin.cn/post/7233327509919547452',
  {
    selector: '.main-area p',
  }
);

const documents = await cheerioLoader.load();

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 400, // 400 字符
  chunkOverlap: 50, // 重叠 50 字符
  separators: ['。', '！', '？'], // 分割符
});

const splitDocuments = await textSplitter.splitDocuments(documents);

// console.log(documents);
console.log(splitDocuments);
