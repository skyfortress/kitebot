import { Module } from '@nestjs/common';
import { MongoClient } from 'mongodb';

@Module({
  providers: [
    {
      provide: 'MONGODB_CONNECTION',
      useFactory: async () => {
        const client = new MongoClient(process.env.MONGODB_DSN!);
        await client.connect();
        console.log('Connected to MongoDB');

        return client;
      },
    },
  ],
  exports: ['MONGODB_CONNECTION'],
})
export class MongodbModule {}
