import { Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { TelegramModule } from '@app/telegram/telegram.module';
import { VisionModule } from '@app/vision/vision.module';
import { BrowserModule } from '@app/browser/browser.module';
import { TaskModule } from '@app/task/task.module';
import { SpotModule } from '@app/spot/spot.module';
import { ForecastModule } from '@app/forecast/forecast.module';
import { SettingsModule } from '@app/settings/settings.module';

@Module({
  imports: [
    TaskModule,
    TelegramModule,
    VisionModule,
    BrowserModule,
    SpotModule,
    ForecastModule,
    SettingsModule,
  ],
  providers: [WatcherService],
})
export class WatcherModule {}
