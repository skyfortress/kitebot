import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { BrowserModule } from '@app/browser/browser.module';
import TelegramBot from 'node-telegram-bot-api';
import { VisionModule } from '@app/vision/vision.module';
import { SpotModule } from '@app/spot/spot.module';
import { OpenaiModule } from '@app/openai/openai.module';
import { SettingsModule } from '@app/settings/settings.module';

@Module({
  imports: [BrowserModule, VisionModule, SpotModule, OpenaiModule, SettingsModule],
  providers: [
    TelegramService,
    {
      provide: 'TELEGRAM_BOT',
      useFactory: async () => {
        console.log('Starting Telegram bot');
        const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, {
          polling: true,
        });

        return bot;
      },
      inject: [],
    },
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
