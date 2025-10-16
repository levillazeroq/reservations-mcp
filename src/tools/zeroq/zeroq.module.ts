import { Module } from '@nestjs/common';
import { ZeroQService } from './zeroq.service';
import { HttpModule } from '../../common/http/http.module';
import { ConfigModule } from '../../config/config.module';
import { UtilsModule } from '../../utils/utils.module';

@Module({
  imports: [HttpModule, ConfigModule, UtilsModule],
  providers: [ZeroQService],
  exports: [ZeroQService],
})
export class ZeroQModule {}

