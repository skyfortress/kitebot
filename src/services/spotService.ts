import { MongoClient, Db, Collection } from 'mongodb';
import { Spot } from '../types';

class SpotService {
    private db: Db;
    private collection: Collection<Spot>;

    constructor(private readonly client: MongoClient) {
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

export default SpotService;