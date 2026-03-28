import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { UsersModule } from '../users/users.module';
import { ToolModule } from 'src/tool/tool.module';

@Module({
  imports: [UsersModule, ToolModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
