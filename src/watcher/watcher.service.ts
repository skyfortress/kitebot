import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MongoClient } from 'mongodb';
import { getTimes } from 'suncalc';
import { DateTime } from 'luxon';
import { BrowserService } from '@app/browser/browser.service';
import { TelegramService } from '@app/telegram/telegram.service';
import { VisionService } from '@app/vision/vision.service';
import { Observation, Spot } from '@app/mongodb/types';

@Injectable()
export class WatcherService {
  constructor(
    @Inject('MONGODB_CONNECTION') private readonly client: MongoClient,
    private readonly browserService: BrowserService,
    private readonly telegramService: TelegramService,
    private readonly visionService: VisionService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  public async watch() {
    const now = new Date();
    const times = getTimes(now, 38.7131707, -9.4054484); // Cascais
    const isDay = times.sunrise < now && now < times.sunset;
    if (!isDay) {
      return;
    }
    const spots = await this.client
      .db()
      .collection<Spot>('spots')
      .find({})
      .toArray();
    for (const spot of spots) {
      if (now > spot.nextCheck) {
        console.log(`Performing spot check for ${spot.name}`);
        const imagePath = await this.browserService.getSpotImages(spot);
        const result = await this.visionService.analyzeImage(spot, imagePath);
        const hasKiters = result.matches.some((el) => el.label === 'kite');
        //TODO: for debug only
        if (hasKiters) {
          await this.telegramService.messageMeAboutKiters(result);
        }
        const lastKiterSeenMinutes = DateTime.fromJSDate(spot.lastKiterSeen)
          .diffNow()
          .as('minutes');
        await this.client
          .db()
          .collection<Observation>('observations')
          .insertOne({ ...result, spot: spot.name, createdAt: now });
        await this.client
          .db()
          .collection<Spot>('spots')
          .updateOne(
            { _id: spot._id },
            {
              $set: {
                hasKiters,
                lastKiterSeen: hasKiters ? now : spot.lastKiterSeen,
                nextCheck: DateTime.now()
                  .plus({
                    minutes: hasKiters && lastKiterSeenMinutes < 30 ? 5 : 30,
                  })
                  .toJSDate(),
              },
            },
          );
        break;
      } else {
        console.log(`Skipping spot check for ${spot.name}`);
      }
    }
  }
}
