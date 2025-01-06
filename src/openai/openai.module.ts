import { Module } from '@nestjs/common';
import OpenAI from 'openai';

@Module({
  providers: [
    {
      provide: 'OPENAI',
      useFactory: async () => {
        return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      },
    },
  ],
  exports: ['OPENAI'],
})
export class OpenaiModule {}
