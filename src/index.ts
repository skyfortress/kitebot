import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { join } from 'path';
import { firefox, devices } from 'playwright';
import { Browser, BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';

let browser: Browser;
let context: BrowserContext;
const prepareEnvirnoment = async () => {
  browser = await firefox.launch();
  context = await browser.newContext({
    ...devices['Desktop Firefox'],
  });
  context.addCookies([
    { 
      name: '.AspNetCore.Identity.Application', 
      value:
      'CfDJ8LwlmD2SdXJLg6EFh_xHq-rfSDa-r5ZcaEj0gWLWOwDoEqnerdZL06nwiMzA54Y2tzVa-Eheo0EaJyONwH5KzYhDW6kP39K4wMosbE1LB9JypJmwFsv1HGNBsJwgR7Smo57WY5MQNU_5uO4zzrNuqcc9TXQQtcuYzFDrcHpmAs48Prd-21ZzlJRd1sYCZ_1JK2U5UE4tVtXoDGaTS8iKCR_eziJnSLyh1bZdfm_DJD6yqQ_TKMJdp5tbJT68daYtSkB6XO2_xugHhY6TJVam7rIIzCO0JxfVt9i-SnnWoJEM7uzfXFUclPyQlgJPxtDlIqxdSRZVEjxbS-KY2XsI78ikpvE1o58SA7AQiXWcSLzF5C7hA2BrXSRsnbqyaZut98dZZRYNC3HBKtZId-FmcReMnZl1y-7aXr-OtW8qwty3olurXHqjA9gWrYB6HEnKYZ1RS9vrKGK7js8jBHg4Rf3ltm39z0_-I1EW-FnvSi3BoX4jQQL3NgJqL8oBozgYRTMTcs-evrkNfR7gdfOzX-cuo4MtaKRPXIQazWexD7CUhbQ1CGktnBpv1imjCpmaW5Sv0FOk-9DPEsP58YCouL1giM6ykDUlofJU3HBO2oCD7EJXCFQoBMVK8rhAVYJO16SlNSW8BXSetuzA3h9G7DLrMI6NIIhicRRsyd2H5q-zFRCnkrw0jYfv1JYV3E4kq7AePkA9HgTbjJDsbxroRxQ',
      path: '/',
      domain: 'beachcam.meo.pt',
    }
  ]); //TODO: move to env
  return { browser, context };
};

dotenv.config({ path: join(__dirname, '../.env')});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const availableWebcams = {
  'Guincho': 'https://beachcam.meo.pt/livecams/praia-do-guincho/',
  'Albufeira': 'https://beachcam.meo.pt/livecams/lagoa-de-albufeira/',
};


const getSpotImage = async (location: keyof typeof availableWebcams) => {
  console.log('Getting image for', location);
  const page = await context.newPage();
  await page.goto(availableWebcams[location]);

  await page.getByLabel('video').first().scrollIntoViewIfNeeded();
  await page.getByLabel('video').first().click();
  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await page.waitForTimeout(2000);
  const image = await page.screenshot();
  console.log('Image is ready');
  await page.close();

  return image;
};

// Create a bot that uses 'polling' to fetch new updates
const bot: TelegramBot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: true });

// Matches "/start"
bot.onText(/\/start/, (msg) => {
  const chatId: number = msg.chat.id;
  bot.sendMessage(chatId, 'Hi! I am your bot. How can I help you?');
});

// Listen for any kind of message. There are different kinds of messages.
bot.on('message', async(msg) => {
  console.log(msg);
  const chatId: number = msg.chat.id;

  if (!msg.text || !msg.text.includes(process.env.TELEGRAM_BOT_NAME!) ) {
    return;
  }

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: "Говори українською, використовуючи зумерський сленг та емоджі. Замість повітряний змій кажи кайт. Гуінчо, гінчо - це Guincho, a лда, алба, альбуфейра, альба - це albufeira" }
      ],
    },
    {
      role: "user",
      content: [
        { type: "text", text: msg.text }
      ],
    },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    tools: [
      {
        type: "function",
        function: {
          name: "getSpotImage",
          description: "Get live image from the spot. Look at the spot and tell me whehter you see kitesurfers or not.",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The spot name",
              },
              unit: { type: "string", enum: Object.keys(availableWebcams) },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: 'auto',
    messages: messages,
  });
  const responseMessage = response.choices[0].message!;


  const toolCalls = responseMessage.tool_calls;
  if (toolCalls) {
    console.log('Got tools call', toolCalls);
    // Step 3: call the function
    // Note: the JSON response may not always be valid; be sure to handle errors
    const availableFunctions: {[key: string]: CallableFunction} = {
      getSpotImage: getSpotImage,
    }; // only one function in this example, but you can have multiple

    messages.push(responseMessage); // extend conversation with assistant's reply
    let image = null;
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const functionToCall = availableFunctions[functionName];
      const functionArgs = JSON.parse(toolCall.function.arguments);
      image = await functionToCall(
        functionArgs.location,
      );
      messages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: functionName,
        content: 'ok',
      } as ChatCompletionMessageParam);

      messages.push({
        role: "user",
        content: [{
          type: "image_url",
          image_url: {
            "url": `data:image/jpeg;base64,${image.toString('base64')}`,
          },
        }],
      } as ChatCompletionMessageParam);
    }
    const secondResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
    }); // get a new response from the model where it can see the function response
    await bot.sendPhoto(chatId, image, {
      caption: secondResponse.choices[0].message.content!
    });
  } else {
    await bot.sendMessage(chatId, responseMessage.content!);
  }
});

prepareEnvirnoment().then(async () => {
  console.log('Browser is ready');
});
