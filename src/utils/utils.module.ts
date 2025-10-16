import { Module } from '@nestjs/common';
import { DateUtilsService } from './date-utils.service';

@Module({
  providers: [DateUtilsService],
  exports: [DateUtilsService],
})
export class UtilsModule {}

