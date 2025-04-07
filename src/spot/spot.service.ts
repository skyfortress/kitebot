import { Spot } from '@app/mongodb/types';
import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Collection, Db, MongoClient } from 'mongodb';

@Injectable()
export class SpotService {
  private db: Db;
  private collection: Collection<Spot>;

  constructor(
    @Inject('MONGODB_CONNECTION') private readonly client: MongoClient,
  ) {
    this.db = this.client.db();
    this.collection = this.db.collection<Spot>('spots');
  }

  async getAllSpots(): Promise<Spot[]> {
    return this.collection.find().toArray();
  }

  async getSpotsForCheck(): Promise<Spot[]> {
    return this.collection.find({ nextCheck: { $lt: new Date() } }).toArray();
  }

  async getSpotByName(name: string): Promise<Spot | null> {
    return this.collection.findOne({ name });
  }

  async createSpot(spot: Spot): Promise<void> {
    await this.collection.insertOne(spot);
  }

  async setKiteableForecast(
    spot: Spot,
    hasKiteableForecast: boolean,
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: spot._id },
      {
        $set: {
          ...(hasKiteableForecast ? { nextCheck: new Date() } : {}), //don't wait for the next check if we have a kiteable forecast
          hasKiteableForecast,
        },
      },
    );
  }

  async scheduleNextCheck({
    spot,
    hasKiters,
    delayMinuntes,
  }: {
    spot: Spot;
    hasKiters: boolean;
    delayMinuntes: number;
  }): Promise<void> {
    await this.collection.updateOne(
      { _id: spot._id },
      {
        $set: {
          hasKiters,
          lastKiterSeen: hasKiters ? new Date() : spot.lastKiterSeen,
          nextCheck: DateTime.now()
            .plus({
              minutes: delayMinuntes,
            })
            .toJSDate(),
        },
      },
    );
  }
}
