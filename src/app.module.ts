import { Module } from '@nestjs/common';
import { TelegramModule } from './telegram/telegram.module';
import { MongodbModule } from './mongodb/mongodb.module';
import { OpenaiModule } from './openai/openai.module';
import { BrowserModule } from './browser/browser.module';
import { VisionModule } from './vision/vision.module';
import { SpotModule } from './spot/spot.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WatcherModule } from './watcher/watcher.module';
import { TaskModule } from './task/task.module';
import { ForecastModule } from './forecast/forecast.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TelegramModule,
    MongodbModule,
    OpenaiModule,
    BrowserModule,
    VisionModule,
    SpotModule,
    WatcherModule,
    TaskModule,
    ForecastModule,
    SettingsModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
