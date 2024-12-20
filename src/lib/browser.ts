import { BrowserContext, firefox } from "@playwright/test";
import { availableSpots } from "../config";
import { getSpotImages } from "./tools";

export async function meoLogin(context: BrowserContext) {
  const page = await context.newPage();

  await page.goto('https://beachcam.meo.pt/login/');
  if (page.url().includes('login')) {
    console.log('preforming the login into meo beachcam')
    await page.fill('input[name="signInModel.Username"]', process.env.MEO_LOGIN!);
    await page.fill('input[name="signInModel.Password"]', process.env.MEO_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.close();
  }

  // Wait for navigation or a specific element indi cating a successful login
  console.log('logged in');
}

export const prepareEnvirnoment = async () => {
  const context = await firefox.launchPersistentContext('.browser', { headless: !process.env.DEBUG, serviceWorkers: 'block' });

  context.addCookies([
    {
      name: 'wgcookie',
      value: '2|msd|c|m|3|22||384|forecast|185|||0|1|_|0|||||||||cm',
      path: '/',
      domain: 'www.windguru.cz'
    },
  ]);

  await meoLogin(context);
  setInterval(async () => {
    await meoLogin(context)
  }, 1000 * 60 * 60 * 24);

  return { context };
};

