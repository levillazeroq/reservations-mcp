import { Module } from '@nestjs/common';
import { MCPController } from './mcp.controller';
import { McpSseController } from './mcp-sse.controller';
import { MCPService } from './mcp.service';
import { ZeroQModule } from '../tools/zeroq/zeroq.module';

@Module({
  imports: [ZeroQModule],
  controllers: [MCPController, McpSseController],
  providers: [MCPService],
})
export class MCPModule {}

