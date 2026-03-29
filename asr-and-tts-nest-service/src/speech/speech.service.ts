import { Inject, Injectable } from '@nestjs/common';
import type * as tencentcloud from 'tencentcloud-sdk-nodejs';

type UploadedAudio = {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
};

type AsrClient = InstanceType<typeof tencentcloud.asr.v20190614.Client>;

@Injectable()
export class SpeechService {
    constructor(@Inject('ASR_CLIENT') private readonly asrClient: AsrClient) { }

    async recognizeBySentence(file: UploadedAudio): Promise<string> {
        // 1. 将音频 Buffer 转为 Base64 字符串
        const audioBase64 = file.buffer.toString('base64');

        // 2. 调用腾讯云一句话识别 API
        const result = await this.asrClient.SentenceRecognition({
            EngSerViceType: '16k_zh',
            SourceType: 1,
            Data: audioBase64,
            DataLen: file.buffer.length,
            VoiceFormat: 'ogg-opus',
        });

        return result.Result ?? '';
    }
}