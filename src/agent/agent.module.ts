import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ZeroQModule } from '../tools/zeroq/zeroq.module';

@Module({
  imports: [ZeroQModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}

