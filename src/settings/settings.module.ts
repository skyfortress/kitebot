import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { MongodbModule } from '@app/mongodb/mongodb.module';

@Module({
  imports: [MongodbModule],
  providers: [SettingsService],
  exports: [SettingsService]
})
export class SettingsModule {}
