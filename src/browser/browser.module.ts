import { Module } from '@nestjs/common';
import { BrowserService } from './browser.service';
import { firefox } from '@playwright/test';

@Module({
  providers: [
    BrowserService,
    {
      provide: 'BROWSER',
      useFactory: async () => {
        const context = await firefox.launchPersistentContext('.browser', {
          headless: !process.env.DEBUG,
          serviceWorkers: 'block',
        });

        context.addCookies([
          {
            name: 'wgcookie',
            value: '2|msd|c|m|3|22||384|forecast|185|||0|1|_|0|||||||||cm',
            path: '/',
            domain: 'www.windguru.cz',
          },
        ]);
        console.log('Browser is opened');
        return context;
      },
    },
  ],
  exports: [BrowserService],
})
export class BrowserModule {}
