import { Module } from '@nestjs/common';
import { SpotService } from './spot.service';
import { MongodbModule } from '@app/mongodb/mongodb.module';

@Module({
  imports: [MongodbModule],
  providers: [SpotService],
  exports: [SpotService],
})
export class SpotModule {}
