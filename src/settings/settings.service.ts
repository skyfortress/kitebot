import { Inject, Injectable } from '@nestjs/common';
import { Collection, Db, MongoClient } from 'mongodb';
import { Settings } from './settings.entity';

@Injectable()
export class SettingsService {
  private db: Db;
  private collection: Collection<Settings>;

  constructor(
    @Inject('MONGODB_CONNECTION') private readonly client: MongoClient,
  ) {
    this.db = this.client.db();
    this.collection = this.db.collection<Settings>('settings');
  }

  async getSettings(): Promise<Settings> {
    const settings = await this.collection.findOne({});
    if (!settings) {
      const newSettings = { ownerId: 90780619, subscribedChats: [], enabled: true };
      await this.collection.insertOne(newSettings);
      return newSettings;
    }
    return settings;
  }

  async update(data: Partial<Settings>): Promise<Settings> {
    await this.collection.updateOne(
      {},
      { $set: data },
    );
    return this.getSettings();
  }

  async toggleSubscribedChat(chatId: number, enabled: boolean): Promise<Settings> {
    const settings = await this.getSettings();

    await this.collection.updateOne(
      {},
      {
        $set: {
          subscribedChats: enabled
            ? Array.from(new Set([...settings.subscribedChats, chatId]))
            : settings.subscribedChats.filter(id => id !== chatId)
        }
      }
    );

    return this.getSettings();
  }
}
