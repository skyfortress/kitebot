import { Forecast, ForecastItem, Spot } from '@app/mongodb/types';
import { Inject, Injectable } from '@nestjs/common';
import { Db, Collection, MongoClient } from 'mongodb';
import { DateTime } from 'luxon';
import { mean } from 'lodash';

@Injectable()
export class ForecastService {
  private db: Db;
  private collection: Collection<Forecast>;

  constructor(
    @Inject('MONGODB_CONNECTION') private readonly client: MongoClient,
  ) {
    this.db = this.client.db();
    this.collection = this.db.collection<Forecast>('forecasts');
  }

  async storeForecast(
    spot: Spot,
    forecastItems: ForecastItem[],
  ): Promise<Forecast> {
    const model = {
      spot: spot.name,
      items: forecastItems,
      createdAt: new Date(),
      isKitebable: await this.isNowKitebable(forecastItems),
    } as Forecast;
    const record = await this.collection.insertOne(model);
    return { _id: record.insertedId, ...model };
  }

  async isNowKitebable(items: ForecastItem[]): Promise<boolean> {
    const now = DateTime.now().set({ minute: 0 });
    const relevantForecastItems = items.filter((item) => {
      const date = DateTime.fromJSDate(item.date);
      return date >= now && date.diff(now).as('hours') < 4;
    });
    return mean(relevantForecastItems.map((item) => item.speed)) >= 5.5;
  }
}