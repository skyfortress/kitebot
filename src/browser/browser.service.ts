import { availableSpots, Locations } from '@app/config';
import { Spot } from '@app/mongodb/types';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BrowserContext } from '@playwright/test';
import { zipWith } from 'lodash';
import { resolve } from 'path';

@Injectable()
export class BrowserService implements OnModuleInit {
  constructor(@Inject('BROWSER') private readonly context: BrowserContext) {}

  async onModuleInit() {
    await this.meoLogin();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async meoLogin() {
    const page = await this.context.newPage();

    await page.goto('https://beachcam.meo.pt/login/');
    if (page.url().includes('login')) {
      console.log('preforming the login into meo beachcam');
      await page.fill(
        'input[name="signInModel.Username"]',
        process.env.MEO_LOGIN!,
      );
      await page.fill(
        'input[name="signInModel.Password"]',
        process.env.MEO_PASSWORD!,
      );
      await page.click('button[type="submit"]');
      await page.close();
    }

    // Wait for navigation or a specific element indi cating a successful login
    console.log('logged in');
  }

  async getSpotImages({
    spot,
    amount,
    delay,
  }: {
    spot: Spot;
    amount: number;
    delay?: number;
  }): Promise<string[]> {
    console.log('Getting image for', spot.name);
    const page = await this.context.newPage();
    await page.goto(spot.webcam);
    await page.getByLabel('video').first().scrollIntoViewIfNeeded();
    await page.getByLabel('video').first().click({ timeout: 60000 });
    await page.getByRole('button', { name: 'Fullscreen' }).click();
    await page.waitForTimeout(2000);

    const screenshots = [];
    for (let i = 0; i < amount; i++) {
      console.log('Taking screenshot', i);
      const timestamp = new Date().toISOString().slice(0, 19);
      const path = resolve(
        __dirname,
        '../../images',
        spot.name,
        `${timestamp}.jpg`,
      );
      await page.screenshot({
        path,
      });
      screenshots.push(path);
      if (amount > 1 && delay) {
        await page.waitForTimeout(delay);
      }
    }
    await page.close();
    return screenshots;
  }

  // TODO: reduce number of tokens
  async getForecast(location: Locations) {
    const page = await this.context.newPage();
    const spot = availableSpots[location];
    await page.goto(spot.forecast);

    await page.locator('#tabid_1_content_div').click(); // to wait until table is loaded
    const data = page.locator('#div_wgfcst1');

    const fetchRowData = async (selector: string) =>
      (await data.locator(selector).allTextContents()).filter(Boolean);

    const dates = await fetchRowData('#tabid_1_0_dates td');

    const windSpd = await fetchRowData('#tabid_1_0_WINDSPD td');
    const windGusts = await fetchRowData('#tabid_1_0_GUST td');
    const temperature = await fetchRowData('#tabid_1_0_TMPE td');
    const waves = await fetchRowData('#tabid_1_0_HTSGW td');

    const forecast = zipWith(
      dates,
      windSpd,
      windGusts,
      temperature,
      waves,
      (date, speed, gust, temp, wave) => {
        const dateParts = date.match(/(\w+)(\d+).(\w+)/);
        if (!dateParts) {
          return false;
        }
        const hour = parseInt(dateParts[3]);

        if (hour > 21 || hour < 9) {
          return false;
        }

        return {
          date: `${dateParts[1]} ${dateParts[2]} ${dateParts[3]}`,
          speed: `${speed} m/s`,
          isKiteable: parseFloat(speed) >= 7,
          gusts: `${gust} m/s`,
          isGusty: parseFloat(gust) - parseFloat(speed) > 4,
          temperature: `${temp} °C`,
          ...(spot.isOcean
            ? {
                waves: `${wave} m`,
                wavesTooHigh: parseFloat(wave) > 2.5,
              }
            : {}),
        };
      },
    ).filter(Boolean);

    console.log(forecast[0], forecast.length);
    await page.close();

    return forecast.slice(0, 20); // TODO: find better way
  }
}
