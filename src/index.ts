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
      'CfDJ8ACKJw63LjhAvoykV3hYNlW-unH8YP8eid9lqLTgjUEaRBNBpV5Vkn4wopEqy5kQBAh0cQ1iD8TmKetn8DI5nAn_8Tmot4ZAs9EN64-TSPTjtciovT6JTk_7ar57TI-K2bpE4oy_N0qvwBDmQRT9j9aaw3q8qm1F5Lss84hQiNPfK2GggB0_7AprzX1mjaxSRPW8yM1FjS_QUuwfh4KH0JX-NjIVxzrh8p3b-gTa556mto0lnx0T2dakOYr-pAg9F2gYGOULhuZyQul7HXYuAsl-YmeRNn4t3EGvSeVWdkEBjBS0TR0J5dwVW12nWL-mKFLuWbvuMcwWgnzDzdlr2Ubh_ZAzjOytosmLHMN-aZ0k8ANGvA2CqXQ_7dUFF0Hr4OgN8kogafuupmeZ5vCGd8KJQljTtGOP9QlkVA-qwuCVDdnGQ4BzPUzV2Zf_ibtawuLuZB2A0BZUvnm9HoKqHPlESlP7iV8LyUvJ4-rllQSJC3WhsI-eUTS6NfsfMI3IDe1KTsjpiieVDET79JN4NQ0HaFSMI8QbbHjDCQyXPRYl2O9gly1bvHvGGCoOCYHWyoqsm9O6ZDapDvc2JKVbrAUp0VCptoobwWavg9abrpFy_SevfoyeWmMgIa2ebo2Siot62ynwEazQM-Q-KLTkj_5HjO5vQmwK8jy3BXxLIk8owpu4zhSi7UBzg4rmYIcPuQ',
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

const shouldReply = (msg: TelegramBot.Message) => {
  if (msg.text?.includes(process.env.TELEGRAM_BOT_NAME!) 
    || msg.chat.type === 'private' 
    || msg.reply_to_message?.from?.username === process.env.TELEGRAM_BOT_NAME!.slice(1)
  ) {
    return true;
  }
  return false;
}

// Listen for any kind of message. There are different kinds of messages.
bot.on('message', async(msg) => {
  console.log(msg);
  const chatId: number = msg.chat.id;

  if (!shouldReply(msg)) {
    return;
  }

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: `Говори українською, використовуючи зумерський сленг та емоджі. Замість повітряний змій кажи кайт. Гуінчо, гінчо - це Guincho, a лда, алба, альбуфейра, альба - це albufeira.` }
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
      { type: "text", text: msg.text! }
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
        content: 'Відповідь формуй у форматі JSON без Markdown: {message: string; bestScreenIndex: number}',
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
