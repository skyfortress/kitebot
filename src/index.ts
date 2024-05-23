import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { spawn } from 'child_process';
import { readFileSync } from 'node:fs';
import { join } from 'path';
dotenv.config({ path: join(__dirname, '../.env')});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const availableWebcams = {
  'Guincho': 'https://beachcam.meo.pt/livecams/praia-do-guincho/',
  'Albufeira': 'https://beachcam.meo.pt/livecams/lagoa-de-albufeira/',
};


const getSpotImage = async (location: keyof typeof availableWebcams) => {
  return new Promise((resolve, reject) => {
    console.log(`Getting spot image on ${location}`);
    const test = spawn('npx', ['playwright', 'test'], 
      { 
        cwd: join(__dirname, '../'),
        env: { ...process.env, WEBCAM_URL: availableWebcams[location]}
      }
    );
    test.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });


    test.on('exit', (code) => {
      console.log(`child process exited with code ${code}`);
      if(code !== 0) {
        reject(false);
      }
      const image = readFileSync(join(__dirname, '../screens/screenshot.png'));
      resolve(image);
    }); 
  });
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

