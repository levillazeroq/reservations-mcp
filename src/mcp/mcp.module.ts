import { Module } from '@nestjs/common';
import { MCPController } from './mcp.controller';
import { MCPService } from './mcp.service';
import { ZeroQModule } from '../tools/zeroq/zeroq.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [ZeroQModule, AgentModule],
  controllers: [MCPController],
  providers: [MCPService],
})
export class MCPModule {}

