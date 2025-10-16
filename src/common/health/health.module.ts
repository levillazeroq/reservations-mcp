import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HttpModule } from '../http/http.module';
import { ConfigModule } from '../../config/config.module';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}

