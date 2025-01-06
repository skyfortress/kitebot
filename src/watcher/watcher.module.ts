import { Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { MongodbModule } from '@app/mongodb/mongodb.module';
import { TelegramModule } from '@app/telegram/telegram.module';
import { VisionModule } from '@app/vision/vision.module';
import { BrowserModule } from '@app/browser/browser.module';

@Module({
  imports: [MongodbModule, TelegramModule, VisionModule, BrowserModule],
  providers: [WatcherService],
})
export class WatcherModule {}
