import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { wrapOpenAI } from 'langsmith/wrappers';

@Module({
  providers: [
    {
      provide: 'OPENAI',
      useFactory: async () => {
        return wrapOpenAI(new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }));
      },
    },
  ],
  exports: ['OPENAI'],
})
export class OpenaiModule {}
