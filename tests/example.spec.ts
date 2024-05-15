import { test, expect } from '@playwright/test';
import OpenAI from "openai";
import axios from 'axios';
import { readFileSync, createReadStream } from 'fs';
import FormData from 'form-data';

// Your bot token
const botToken = '6588479636:AAHWHCq7WNIoteGlAfhXjhvU7m2LkkhGhnc';
// The chat ID where you want to send the message
const chatId = '90780619';


const openai = new OpenAI({ apiKey: 'sk-proj-T5zQxqpf3oYiPzvWoX5QT3BlbkFJnVfA7j3G4McYCf0XRnkD' });


test('has title', async ({ page, context }) => {
  context.addCookies([
    { 
      name: '.AspNetCore.Identity.Application', 
      value:
      'CfDJ8LwlmD2SdXJLg6EFh_xHq-rfSDa-r5ZcaEj0gWLWOwDoEqnerdZL06nwiMzA54Y2tzVa-Eheo0EaJyONwH5KzYhDW6kP39K4wMosbE1LB9JypJmwFsv1HGNBsJwgR7Smo57WY5MQNU_5uO4zzrNuqcc9TXQQtcuYzFDrcHpmAs48Prd-21ZzlJRd1sYCZ_1JK2U5UE4tVtXoDGaTS8iKCR_eziJnSLyh1bZdfm_DJD6yqQ_TKMJdp5tbJT68daYtSkB6XO2_xugHhY6TJVam7rIIzCO0JxfVt9i-SnnWoJEM7uzfXFUclPyQlgJPxtDlIqxdSRZVEjxbS-KY2XsI78ikpvE1o58SA7AQiXWcSLzF5C7hA2BrXSRsnbqyaZut98dZZRYNC3HBKtZId-FmcReMnZl1y-7aXr-OtW8qwty3olurXHqjA9gWrYB6HEnKYZ1RS9vrKGK7js8jBHg4Rf3ltm39z0_-I1EW-FnvSi3BoX4jQQL3NgJqL8oBozgYRTMTcs-evrkNfR7gdfOzX-cuo4MtaKRPXIQazWexD7CUhbQ1CGktnBpv1imjCpmaW5Sv0FOk-9DPEsP58YCouL1giM6ykDUlofJU3HBO2oCD7EJXCFQoBMVK8rhAVYJO16SlNSW8BXSetuzA3h9G7DLrMI6NIIhicRRsyd2H5q-zFRCnkrw0jYfv1JYV3E4kq7AePkA9HgTbjJDsbxroRxQ',
      path: '/',
      domain: 'beachcam.meo.pt',
    }
  ])
  await page.goto('https://beachcam.meo.pt/livecams/lagoa-de-albufeira/');

  // await page.getByLabel('Consentir', { exact: true }).click();
  await page.getByLabel('video').scrollIntoViewIfNeeded();
  // await page.waitForTimeout(20000);
  await page.getByLabel('video').first().click();
  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screens/screenshot.png' });
  const image = readFileSync('./screens/screenshot.png');

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Do you see any kites on the image? Говори українською, використовуючи зумерський сленг та емоджі. Замість повітряний змій кажи кайт. Відповідь сформуй у форматі JSON: {msg: string; answer: boolean}, не додавай теги markdown" },
          {
            type: "image_url",
            image_url: {
              "url": `data:image/jpeg;base64,${image.toString('base64')}`,
            },
          },
        ],
      },
    ],
  });


  const updates = await axios.get(`https://api.telegram.org/bot${botToken}/getUpdates`);
  console.log(response.choices[0].message.content)
  const msg = JSON.parse(response.choices[0].message.content!);
  if (msg.answer) {
    const formData = new FormData();
    
    formData.append('chat_id', chatId);
    formData.append('photo', createReadStream('screenshot.png'));
    formData.append('caption', msg.msg);

    await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, formData, {
        headers: formData.getHeaders(),
    });
  }
});