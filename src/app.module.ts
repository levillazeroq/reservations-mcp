import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { HttpModule } from './common/http/http.module';
import { MCPModule } from './mcp/mcp.module';
import { AgentModule } from './agent/agent.module';
import { AgentController } from './agent/agent.controller';

@Module({
  imports: [ConfigModule, HttpModule, MCPModule, AgentModule],
  controllers: [AgentController],
  providers: [],
})
export class AppModule {}
