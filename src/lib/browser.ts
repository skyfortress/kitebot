import { firefox } from "@playwright/test";
import { availableSpots } from "../config";

export const prepareEnvirnoment = async () => {
  const context = await firefox.launchPersistentContext('.browser', { headless: true, serviceWorkers: 'block' });

  context.addCookies([
    { 
      name: '.AspNetCore.Identity.Application', 
      value:
      'CfDJ8LwlmD2SdXJLg6EFh_xHq-px_3NVkCv3glMW5Hnlz24X7n26kGON2UbZtwiv-zPcZvTRZoXNdEppDnjtrOu8NbK19hoyHuFMPE9GCK1nsgbjg9jsVswMOWX6KwBaZQOVFF23vHP11ZwOvFRp68deY7mCf2Su4XKoHKGOSGbG7ivDwkVf7mQZZmnqfj_KsFAwu4PGBg5YBg7fDlNIcjhdIb-7XSfI6vTnLT-CqoqfrAl_oqcRAWqob5HFW1lj0xZ_d3blxU9p3Nmz952LoAlg_KK937ah6pK37Xu2ofAAT-VN6S7350TUWzAYmCBFaccZvwVR8Me3mtrdpiDzCtD6wPQJkp8cjDVzX2tPuhzyEVg1wG80dPd1fn4SW82wb_DrnqG5dMDouLVfzyu-YPBU1TVhA6wwBs6gmqzDHTkv9JWQOhUXhjls38nrmOr0o45azXQc63bPxopNLoJMKXssW8Gv4WwBq0rimatQjq5lBLuIRcbxr7rLsL0VVYUgP--lt6W9pkCwlcqR-hiofX-EkKqTV7ZRKmmy_2wn0L9ZRCBR4OpnEWLJgrgz20KPejST2tQ9UI-EPpQJy1uHrmTQtdsld64K807wacjBxQPFLq0crSbl5EvO_5OurVVzUolCkqEQ1b9FMh3FCS7MCb1Hu5CtOZi3RkE26BSEP3bPw2a2bKj_w4rbyeUA9Pr5VS8wvssIGvW8XkPd7C_inSeSwSE',
      path: '/',
      domain: 'beachcam.meo.pt',
    },
    {
      name: 'wgcookie',
      value: '2|msd|c|m|3|22||384|forecast|185|||0|1|_|0|||||||||cm',
      path: '/',
      domain: 'www.windguru.cz'
    },
  ]); //TODO: move to env

  
  const page = await context.newPage();
  await page.goto(availableSpots.Albufeira.forecast);
  try {
    await page.click('#accept-choices', { timeout: 2000 });
  } catch (err) {
    console.log('Cookies has been already accepted');
  } finally {
    await page.close();
  }

  return { context };
};

