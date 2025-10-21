import { Module } from '@nestjs/common';
import { ZeroQService } from './zeroq.service';
import { HttpModule } from '../../common/http/http.module';
import { ConfigModule } from '../../config/config.module';
import { UtilsModule } from '../../utils/utils.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [HttpModule, ConfigModule, UtilsModule, CacheModule],
  providers: [ZeroQService],
  exports: [ZeroQService],
})
export class ZeroQModule {}

