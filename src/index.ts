import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { join } from 'path';
import { firefox, devices } from 'playwright';
import { Browser, BrowserContext } from '@playwright/test';

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


const getSpotImages = async (location: keyof typeof availableWebcams): Promise<Buffer[]> => {
  console.log('Getting image for', location);
  const page = await context.newPage();
  await page.goto(availableWebcams[location]);

  await page.getByLabel('video').first().scrollIntoViewIfNeeded();
  await page.getByLabel('video').first().click();
  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await page.waitForTimeout(2000);
  const image1 = await page.screenshot();
  console.log('Image 1 is ready');
  await page.waitForTimeout(15000);
  const image2 = await page.screenshot();
  console.log('Image 2 is ready');
  await page.waitForTimeout(15000);
  const image3 = await page.screenshot();
  console.log('Image 3 is ready');
  await page.close();

  return [image1, image2, image3];
};

const availableFunctions = {
  getSpotImages: getSpotImages,
} as const; // only one function in this example, but you can have multiple

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

  if ((!msg.text || !msg.text.includes(process.env.TELEGRAM_BOT_NAME!) && msg.chat.type !== 'private') ) {
    return;
  }

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: `Говори українською, використовуючи зумерський сленг та емоджі. Замість повітряний змій кажи кайт. Гуінчо, гінчо - це Guincho, a лда, алба, альбуфейра, альба - це albufeira. 
        CHANGELOG:
         25-05-2024
         - getSpotImages now returns 3 images with time interval instead of 1, best one is being sent to the chat
         - bot sends an immediate response that it started looking at webcams
         - now you can reply to bot messages
         - bot understands other message quote in your message
        ` }
      ],
    },
  ];


  if (msg.reply_to_message) {
    if (msg.reply_to_message.from?.username === process.env.TELEGRAM_BOT_NAME!.slice(1)) {
      messages.push({
        role: "assistant",
        content: msg.reply_to_message.text,
      });
    } else {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `${msg.reply_to_message.from?.first_name}: ${msg.reply_to_message.text!}` }
        ],
      });
    }
  }

  messages.push({
    role: "user",
    content: [
      { type: "text", text: msg.text }
    ],
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    tools: [
      {
        type: "function",
        function: {
          name: "getSpotImages",
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

  console.log(responseMessage);
  const toolCalls = responseMessage.tool_calls;

  if (responseMessage.content) {
    await bot.sendMessage(chatId, responseMessage.content);
  }

  if (toolCalls) {
    console.log('Got tools call', toolCalls);
    messages.push(responseMessage); // extend conversation with assistant's reply
    let images: Buffer[] = [];
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name as keyof typeof availableFunctions;
      const functionToCall = availableFunctions[functionName];
      const functionArgs = JSON.parse(toolCall.function.arguments);
      images = await functionToCall(
        functionArgs.location,
      );
      messages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: functionName,
        content: 'Опиши фото і скажи чи бачиш кайти, відповідь формуй у форматі JSON без Markdown: {message: string; bestScreenIndex: number}',
      } as ChatCompletionMessageParam);

      messages.push({
        role: "user",
        content: [
          ...images.map(image => {
            return {
              type: "image_url",
              image_url: {
                "url": `data:image/jpeg;base64,${image.toString('base64')}`,
              }
            };
          })
        ],
      } as ChatCompletionMessageParam);
    }
    const secondResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
    }); // get a new response from the model where it can see the function response
    const answer: {message: string; bestScreenIndex: number} = JSON.parse(secondResponse.choices[0].message.content!);
    console.log(answer);
    await bot.sendPhoto(chatId, images[answer.bestScreenIndex], {
      caption: answer.message
    });
  }
});

prepareEnvirnoment().then(async () => {
  console.log('Browser is ready');
});
