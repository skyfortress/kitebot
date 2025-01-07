import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { getTimes } from 'suncalc';
import { BrowserService } from '@app/browser/browser.service';
import { TelegramService } from '@app/telegram/telegram.service';
import { VisionService } from '@app/vision/vision.service';
import { Observation } from '@app/mongodb/types';
import { TaskService } from '@app/task/task.service';
import { SpotService } from '@app/spot/spot.service';

@Injectable()
export class WatcherService {
  constructor(
    private readonly browserService: BrowserService,
    private readonly telegramService: TelegramService,
    private readonly visionService: VisionService,
    private readonly taskService: TaskService,
    private readonly spotService: SpotService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  public async watch() {
    console.log('Watcher is running');
    const now = new Date();
    const times = getTimes(now, 38.7131707, -9.4054484); // Cascais
    const isDay = times.sunrise < now && now < times.sunset;
    const activeTasks = await this.taskService.getActiveTasks();
    if (!isDay || activeTasks.length > 0) {
      return;
    }

    const spots = await this.spotService.getSpotsForCheck();

    for (const spot of spots) {
      console.log(`Performing spot check for ${spot.name}`);
      const task = await this.taskService.createTask(spot);
      try {
        const images = await this.browserService.getSpotImages({
          spot,
          amount: 4,
          delay: 15000,
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
          await this.telegramService.messageMeAboutKiters(
            spot,
            resultWithKiters,
          );
        }

        await this.taskService.completeTask(task, results);
        await this.spotService.scheduleNextCheck(spot, !!resultWithKiters);
      } catch (e) {
        console.log('Error while processing task', e);
        //TODO: add backoff strategy for spot check
        await this.taskService.failTask(task, e);
      }
    }
  }
}
