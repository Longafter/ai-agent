import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import type { Runnable } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AI_TTS_STREAM_EVENT, type AiTtsStreamEvent } from '../common/stream-events';

@Injectable()
export class AiService {
    private readonly chain: Runnable;

    constructor(
        @Inject('CHAT_MODEL') model: ChatOpenAI,
        private readonly eventEmitter: EventEmitter2,
    ) {
        const prompt = PromptTemplate.fromTemplate(
            '请回答以下问题：\n\n{query}',
        );
        this.chain = prompt.pipe(model).pipe(new StringOutputParser());
    }

    async *streamChain(query: string, ttsSessionId?: string): AsyncGenerator<string> {
        if (ttsSessionId) {
            // 触发 start 事件，建立腾讯云 TTS 连接
            this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
                type: 'start',
                sessionId: ttsSessionId,
                query,
            } as AiTtsStreamEvent);
        }

        const stream = await this.chain.stream({ query });
        try {
            for await (const chunk of stream) {
                if (ttsSessionId) {
                    this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
                        type: 'chunk',
                        sessionId: ttsSessionId,
                        chunk,
                    } as AiTtsStreamEvent);
                }
                yield chunk;
            }
        } catch (error) {
            if (ttsSessionId) {
                this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
                    type: 'error',
                    sessionId: ttsSessionId,
                    error: String(error),
                } as AiTtsStreamEvent);
            }
            throw error;
        }

        if (ttsSessionId) {
            // 触发 end 事件，通知 TTS 合成完成
            this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
                type: 'end',
                sessionId: ttsSessionId,
            } as AiTtsStreamEvent);
        }
    }
}
