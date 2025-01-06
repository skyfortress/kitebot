import { Spot } from '@app/mongodb/types';
import { Inject, Injectable } from '@nestjs/common';
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

  async getSpotById(id: string): Promise<Spot | null> {
    return this.collection.findOne({ id });
  }

  async getSpotByName(name: string): Promise<Spot | null> {
    return this.collection.findOne({ name });
  }

  async createSpot(spot: Spot): Promise<void> {
    await this.collection.insertOne(spot);
  }

  async updateSpot(id: string, spot: Partial<Spot>): Promise<void> {
    await this.collection.updateOne({ id }, { $set: spot });
  }

  async deleteSpot(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }
}
