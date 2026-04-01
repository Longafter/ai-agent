import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';

// ==================== 结构化事件类型定义 ====================

/** 事件类型枚举 */
export enum StreamEventType {
  /** 文本内容增量 */
  TEXT = 'text',
  /** 工具调用开始 */
  TOOL_START = 'tool_start',
  /** 工具调用结束 */
  TOOL_END = 'tool_end',
  /** 错误 */
  ERROR = 'error',
  /** 流结束 */
  DONE = 'done',
}

/** 基础事件接口 */
interface BaseStreamEvent {
  type: StreamEventType;
  timestamp: number;
}

/** 文本事件 */
export interface TextStreamEvent extends BaseStreamEvent {
  type: StreamEventType.TEXT;
  content: string;
}

/** 工具调用开始事件 */
export interface ToolStartStreamEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_START;
  toolCallId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
}

/** 工具调用结束事件 */
export interface ToolEndStreamEvent extends BaseStreamEvent {
  type: StreamEventType.TOOL_END;
  toolCallId: string;
  toolName: string;
  result: string;
}

/** 错误事件 */
export interface ErrorStreamEvent extends BaseStreamEvent {
  type: StreamEventType.ERROR;
  message: string;
  toolName?: string;
}

/** 流结束事件 */
export interface DoneStreamEvent extends BaseStreamEvent {
  type: StreamEventType.DONE;
}

/** 联合事件类型 */
export type StreamEvent =
  | TextStreamEvent
  | ToolStartStreamEvent
  | ToolEndStreamEvent
  | ErrorStreamEvent
  | DoneStreamEvent;

// ==================== 服务实现 ====================

@Injectable()
export class AiService {
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('DB_USERS_CRUD_TOOL') private readonly dbUsersCrudTool: any,
    @Inject('TIME_NOW_TOOL') private readonly timeNowTool: any,
    @Inject('CRON_JOB_TOOL') private readonly cronJobTool: any,
  ) {
    this.modelWithTools = model.bindTools([
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool,
      this.timeNowTool,
      this.cronJobTool,
    ]);
  }

  /**
   * 格式化事件为 SSE 数据字符串
   */
  private formatEvent(event: StreamEvent): string {
    return JSON.stringify(event);
  }

  /**
   * 执行工具调用
   */
  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    try {
      switch (toolName) {
        case 'send_mail':
          return String(await this.sendMailTool.invoke(args));
        case 'web_search':
          return String(await this.webSearchTool.invoke(args));
        case 'db_users_crud':
          return String(await this.dbUsersCrudTool.invoke(args));
        case 'time_now':
          return JSON.stringify(await this.timeNowTool.invoke({}));
        case 'cron_job':
          return String(await this.cronJobTool.invoke(args));
        default:
          return `未知工具: ${toolName}`;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `工具执行错误: ${errorMessage}`;
    }
  }

  async runChain(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        `你是一个通用任务助手，可以根据用户的目标规划步骤，并在需要时调用工具：\`query_user\` 查询或校验用户信息、\`send_mail\` 发送邮件、\`web_search\` 进行互联网搜索、\`db_users_crud\` 读写数据库 users 表、\`time_now\` 获取当前服务器时间、\`cron_job\` 创建和管理定时/周期任务（\`list\`/\`add\`/\`toggle\`），从而实现提醒、定期任务、数据同步等各种自动化需求。

定时任务类型选择规则（非常重要）：
- 用户说"X分钟/小时/天后""在某个时间点""到点提醒"（一次性）=> 用 \`cron_job\` + \`type=at\`（执行一次后自动停用），\`at\`=当前时间+X 或解析出的时间点
- 用户说"每X分钟/每小时/每天""定期/循环/一直"（重复执行）=> 用 \`cron_job\` + \`type=every\`（每次执行），\`everyMs\`=X换算成毫秒
- 用户给出 Cron 表达式或明确说"用 cron 表达式"（重复执行）=> 用 \`cron_job\` + \`type=cron\`

在调用 \`cron_job.add\` 创建任务时，需要把用户原始自然语言拆成两部分：一部分是"什么时候执行"（用来决定 type/at/everyMs/cron），另一部分是"要做什么任务本身"。\`instruction\` 字段只能填"要做什么"的那部分文本（保持原语言和原话），不能再改写、翻译或总结。

当用户请求"在未来某个时间点执行某个动作"（例如"1分钟后给我发一个笑话到邮箱"）时，本轮对话只需要使用 \`cron_job\` 设置/更新定时任务，不要在当前轮直接完成这个动作本身：不要直接调用 \`send_mail\` 给他发邮件，也不要在当前轮就真正"执行"指令，只需把要执行的动作写进 \`instruction\` 里，交给将来的定时任务去跑。

重要：\`cron_job.add\` 的 \`instruction\` 必须是自然语言任务描述，不能写成工具调用/脚本（例如禁止 \`send_mail(...)\`、\`db_users_crud(...)\`、\`web_search(...)\`）。工具调用应该由将来的 JobAgent 在执行时自行决定。

注意：像"\`1分钟后提醒我喝水\`"，时间相关信息用于计算下一次执行时间，而 \`instruction\` 应该是"提醒我喝水"；本轮不需要立刻提醒。`,
      ),
      new HumanMessage(query),
    ];

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];

      // 没有要调用的工具，直接把回答返回给调用方
      if (!toolCalls.length) {
        return aiMessage.content as string;
      }

      // 依次执行本轮需要调用的所有工具
      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name;

        const result = await this.executeTool(toolName, toolCall.args);

        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            name: toolName,
            content: result,
          }),
        );
      }
    }
  }

  async *runChainStream(query: string): AsyncIterable<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        `你是一个通用任务助手，可以在需要时调用工具（如 \`query_user\`、\`db_users_crud\`、\`send_mail\`、\`web_search\`、\`time_now\`、\`cron_job\` 等）来查询或改写数据/配置，规划并执行各种任务（包括提醒、定期任务和一系列后台操作），再用结果回答用户的问题。

定时任务类型选择规则（非常重要）：
- "X分钟/小时/天后""在某个时间点""到点提醒"（一次性）=> \`cron_job.type=at\`（执行一次后自动停用）
- "每X分钟/每小时/每天""定期/循环/一直"（重复执行）=> \`cron_job.type=every\`（每次执行），\`everyMs\`=毫秒
- 给出 Cron 表达式 => \`cron_job.type=cron\``,
      ),
      new HumanMessage(query),
    ];

    try {
      while (true) {
        // 一轮对话：先让模型思考并（可能）提出工具调用
        const stream = await this.modelWithTools.stream(messages);

        let fullAIMessage: AIMessageChunk | null = null;

        for await (const chunk of stream as AsyncIterable<AIMessageChunk>) {
          fullAIMessage = fullAIMessage ? fullAIMessage.concat(chunk) : chunk;

          // 只要 fullAIMessage 里一旦出现了任何工具调用的影子
          const isToolCalling =
            (fullAIMessage.tool_call_chunks?.length ?? 0) > 0;

          // 只有在确定不是工具调用时，才 yield 文本内容事件
          if (!isToolCalling && chunk.content) {
            yield this.formatEvent({
              type: StreamEventType.TEXT,
              content: chunk.content as string,
              timestamp: Date.now(),
            });
          }
        }

        if (!fullAIMessage) {
          yield this.formatEvent({
            type: StreamEventType.DONE,
            timestamp: Date.now(),
          });
          return;
        }

        messages.push(fullAIMessage);

        const toolCalls = fullAIMessage.tool_calls ?? [];

        // 没有工具调用：说明这一轮就是最终回答，已经在上面的 for-await 中流完了，可以结束
        if (!toolCalls.length) {
          yield this.formatEvent({
            type: StreamEventType.DONE,
            timestamp: Date.now(),
          });
          return;
        }

        // 有工具调用：发送工具开始事件，执行工具，发送工具结束事件
        for (const toolCall of toolCalls) {
          const toolCallId = toolCall.id || '';
          const toolName = toolCall.name;
          const toolArgs = toolCall.args as Record<string, unknown>;

          // 发送工具调用开始事件
          yield this.formatEvent({
            type: StreamEventType.TOOL_START,
            toolCallId,
            toolName,
            toolArgs,
            timestamp: Date.now(),
          });

          // 执行工具
          const result = await this.executeTool(toolName, toolArgs);

          // 发送工具调用结束事件
          yield this.formatEvent({
            type: StreamEventType.TOOL_END,
            toolCallId,
            toolName,
            result,
            timestamp: Date.now(),
          });

          // 将工具结果加入消息历史
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        }
      }
    } catch (error) {
      // 发送错误事件
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      yield this.formatEvent({
        type: StreamEventType.ERROR,
        message: errorMessage,
        timestamp: Date.now(),
      });
    }
  }
}
