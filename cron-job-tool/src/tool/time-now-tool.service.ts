import { Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';

@Injectable()
export class TimeNowToolService {
  readonly tool;

  constructor() {
    this.tool = tool(
      async () => {
        const now = new Date();
        // 转换为北京时间 (UTC+8)
        const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const beijingISO = beijingTime.toISOString().replace('Z', '+08:00');

        return {
          iso: beijingISO, // 北京时间 ISO 格式
          timestamp: now.getTime(),
          timezone: 'Asia/Shanghai (UTC+8)',
          note: '当前时间为北京时间，定时任务请使用此时间',
        };
      },
      {
        name: 'time_now',
        description:
          '获取当前服务器时间（北京时间 UTC+8），返回 ISO 字符串和毫秒级时间戳。定时任务应使用返回的时间。',
      },
    );
  }
}
