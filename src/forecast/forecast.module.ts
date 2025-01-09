import { Module } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { MongodbModule } from '@app/mongodb/mongodb.module';

@Module({
  imports: [MongodbModule],
  providers: [ForecastService],
  exports: [ForecastService],
})
export class ForecastModule {}
