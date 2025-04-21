import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getTimes } from 'suncalc';
import { BrowserService } from '@app/browser/browser.service';
import { TelegramService } from '@app/telegram/telegram.service';
import { VisionService } from '@app/vision/vision.service';
import { Observation } from '@app/mongodb/types';
import { TaskService } from '@app/task/task.service';
import { SpotService } from '@app/spot/spot.service';
import { ForecastService } from '@app/forecast/forecast.service';
import { SettingsService } from '@app/settings/settings.service';

@Injectable()
export class WatcherService {
  constructor(
    private readonly browserService: BrowserService,
    private readonly telegramService: TelegramService,
    private readonly visionService: VisionService,
    private readonly taskService: TaskService,
    private readonly spotService: SpotService,
    private readonly forecastService: ForecastService,
    private readonly settingsService: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  public async watch() {
    const settings = await this.settingsService.getSettings();
    if (!settings.enabled) {
      console.log('Bot is disabled, skipping watcher');
      return;
    }
    console.log('Watcher is running');
    const now = new Date();
    const times = getTimes(now, 38.7131707, -9.4054484); // Cascais
    const isDay = times.sunrise < now && now < times.sunset;
    const activeTasks = await this.taskService.getActiveTasks();
    if (activeTasks.length > 0) {
      return;
    }

    const spots = await this.spotService.getSpotsForCheck();

    for (const spot of spots) {
      if (!isDay && !spot.ignoreNight) {
        console.log('Skipping spot check as it is night time');
        continue;
      }
      console.log(`Performing spot check for ${spot.name}`);
      const task = await this.taskService.createTask(spot);
      try {
        const images = await this.browserService.getSpotImages({
          spot,
          amount: 4,
          delay: 20000,
        });

        const results: Observation[] = [];
        for (const image of images) {
          results.push(await this.visionService.analyzeImage(image));
        }

        const resultWithKiters = results.find((el) =>
          el.matches.some((el) => el.label === 'kite'),
        );

        //TODO: for debug only
        if (resultWithKiters) {
          await this.telegramService.messageAboutKiters(
            spot,
            resultWithKiters,
            settings.subscribedChats,
          );
          await this.spotService.scheduleNextCheck({
            spot,
            hasKiters: true,
            delayMinuntes: 6 * 60,
          });
        } else {
          await this.spotService.scheduleNextCheck({
            spot,
            hasKiters: false,
            delayMinuntes: spot.hasKiteableForecast ? 10 : 2 * 60,
          });
        }
        await this.taskService.completeTask(task, results);
      } catch (e) {
        console.log('Error while processing task', e);
        await this.taskService.failTask(task, e);
        //TODO: add backoff strategy for spot check
        await this.spotService.scheduleNextCheck({
          spot,
          hasKiters: false,
          delayMinuntes: 60,
        });
      }
    }
  }

  @Cron(CronExpression.EVERY_3_HOURS)
  async checkForecast() {
    const settings = await this.settingsService.getSettings();
    if (!settings.enabled) {
      console.log('Bot is disabled, skipping forecast check');
      return;
    }
    const spots = await this.spotService.getAllSpots();
    for (const spot of spots) {
      console.log(`Checking forecast for ${spot.name}`);
      const forecastItems = await this.browserService.getForecast(spot);
      const forecast = await this.forecastService.storeForecast(
        spot,
        forecastItems,
      );
      await this.spotService.setKiteableForecast(spot, forecast.isKitebable);
    }
  }
}
