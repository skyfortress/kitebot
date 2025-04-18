import { ForecastItem, Spot } from '@app/mongodb/types';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BrowserContext } from '@playwright/test';
import { zipWith } from 'lodash';
import { resolve } from 'path';
import { firefox } from '@playwright/test';

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
  private context: BrowserContext;

  async createBrowser() {
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
    this.context = context;
  }

  async onModuleInit() {
    await this.createBrowser();
    await this.meoLogin();
  }

  async onModuleDestroy() {
    await this.context.close();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async restartBrowser() {
    console.log('Restarting browser');
    await this.context.close();
    await this.createBrowser();
    await this.meoLogin();
  }

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
    try {
      await page.goto(spot.webcam);
      await page.getByLabel('video').first().scrollIntoViewIfNeeded();

      await page.getByLabel('video').first().click({ timeout: 60000 });
      await page
        .getByRole('button', { name: 'Fullscreen' })
        .click({ timeout: 60000 });

      await page.waitForTimeout(2000);

      const screenshots = [];
      for (let i = 0; i < amount; i++) {
        const playButton = page.getByRole('button', { name: 'Play' });
        if (await playButton.isVisible()) {
          await playButton.click();
        }
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
      return screenshots;
    } catch (e) {
      const timestamp = new Date().toISOString().slice(0, 19);
      const path = resolve(
        __dirname,
        '../../images/failed',
        `${timestamp}.jpg`,
      );
      await page.screenshot({
        path,
      });
      e.screenshot = path;
      console.error('Error while getting image:', e);
      throw e;
    } finally {
      await page.close();
    }
  }

  //TODO: add info about wind dir, percipitation, tides
  async getForecast(spot: Spot): Promise<ForecastItem[]> {
    const page = await this.context.newPage();
    try {
      await page.goto(spot.forecast);

      await page.locator('#tabid_1_content_div').click(); // to wait until table is loaded
      const data = page.locator('#div_wgfcst1');

      const fetchRowData = async (selector: string) =>
        (await data.locator(selector).allTextContents()).filter(Boolean);

      const fetchRowDates = async (selector: string) => {
        const res = await Promise.all(
          (await data.locator(selector).all()).map((el) =>
            el.getAttribute('data-x'),
          ),
        );
        return res
          .filter(Boolean)
          .map((el) => JSON.parse(el))
          .map((el) => new Date(el.unixtime * 1000));
      };

      const dates = await fetchRowDates('#tabid_1_0_dates td');

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
        (date, speed, gusts, temperature, wave) => {
          return {
            date,
            speed: parseFloat(speed),
            gusts: parseFloat(gusts),
            temperature: parseFloat(temperature),
            wave: parseFloat(wave),
          };
        },
      ).filter(Boolean);
      return forecast.slice(0, 40);
    } catch (e) {
      console.error('Error while getting forecast:', e);
      return [];
    } finally {
      await page.close();
    }
  }
}
