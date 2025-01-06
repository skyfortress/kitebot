import { Module } from '@nestjs/common';
import { VisionService } from './vision.service';

@Module({
  providers: [VisionService],
  exports: [VisionService],
})
export class VisionModule {}
