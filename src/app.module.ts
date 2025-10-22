import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { HttpModule } from './common/http/http.module';
import { HealthModule } from './common/health/health.module';
import { MCPModule } from './mcp/mcp.module';

@Module({
  imports: [ConfigModule, HttpModule, HealthModule, MCPModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
