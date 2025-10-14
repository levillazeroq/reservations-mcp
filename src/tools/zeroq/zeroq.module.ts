import { Module } from '@nestjs/common';
import { ZeroQService } from './zeroq.service';

@Module({
  providers: [ZeroQService],
  exports: [ZeroQService],
})
export class ZeroQModule {}

