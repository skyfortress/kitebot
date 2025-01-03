import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { join } from 'path';
import { prepareEnvirnoment } from './lib/browser';
import { Locations, availableSpots } from './config';
import { analyzeImage, getForecast, getSpotImages } from './lib/tools';
import { shouldReply } from './lib/messaging';
import { startCase } from 'lodash';
import { connectToMongoDB } from './lib/db';
import { registerScheduler } from './scheduler';
import SpotService from './services/spotService';
import { startAiServer } from './lib/ai';


dotenv.config({ path: join(__dirname, '../.env')});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });


prepareEnvirnoment().then(async ({ context }) => {
  console.log('Browser is ready');
  startAiServer();
  const connection = await connectToMongoDB();
  await registerScheduler(context, connection);
  const spotServcie = new SpotService(connection);
  // Create a bot that uses 'polling' to fetch new updates
  const bot: TelegramBot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: true });

  bot.setMyCommands([
    { command: 'check', description: 'Check some spot' },
  ]);

  const processCommand = async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
  
    if (text.startsWith('/check')) {
      const param = text.split(' ').slice(1).join(' '); // Extract parameters after the command
      if (param) {
        const spot = await spotServcie.getSpotByName(param);
        if(!spot) {
          bot.sendMessage(chatId, `Spot ${param} not found`);
          return true;
        }
        const imagePath = await getSpotImages(context, spot);
        const result = await analyzeImage(imagePath);
        bot.sendMessage(chatId, JSON.stringify(result));
      } else {
        bot.sendMessage(chatId, 'Usage: /check <spot>');
      }
      return true;
    }
    return false;
  };

  bot.on('message', async(msg) => {
    console.log(msg);
    const chatId: number = msg.chat.id;
    try {
      if (!shouldReply(msg)) {
        return;
      }

      const isCommandHandled = await processCommand(msg);
      if (isCommandHandled) {
        return;
      }

      const currentDate = new Date().toISOString();
    
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: [
            { type: "text", text: `Output only plain text. Do not output markdown. Today: ${currentDate}. Говори українською, використовуючи зумерський сленг та емоджі. Замість повітряний змій кажи кайт, gust - порив. Гуінчо, гінчо - це Guincho, a лда, алба, альбуфейра, альба - це albufeira, фонта чи белла вішта - це fonta, обідош - це obidos.` }
          ],
        },
      ];
    
    
      if (msg.reply_to_message) {
        if (msg.reply_to_message.from?.username === process.env.TELEGRAM_BOT_NAME!.slice(1)) {
          messages.push({
            role: "assistant",
            content: msg.reply_to_message.text || msg.reply_to_message.caption,
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
              name: "getForecast",
              description: "Get forecast for the given spot.",
              parameters: {
                type: "object",
                properties: {
                  location: {
                    type: "string",
                    description: "The spot name",
                  },
                  unit: { type: "string", enum: Object.keys(availableSpots) },
                },
                required: ["location"],
              },
            },
          },
          // should be last
          // {
          //   type: "function",
          //   function: {
          //     name: "getSpotImages",
          //     description: "Get live image from the spot. Look at the spot and tell me whehter you see kitesurfers or not.",
          //     parameters: {
          //       type: "object",
          //       properties: {
          //         location: {
          //           type: "string",
          //           description: "The spot name",
          //         },
          //         unit: { type: "string", enum: Object.keys(availableSpots) },
          //       },
          //       required: ["location"],
          //     },
          //   },
          // },
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
          const functionName = toolCall.function.name as 'getForecast' | 'getSpotImages';
          const functionArgs = JSON.parse(toolCall.function.arguments);

          const location = startCase(functionArgs.location) as Locations;
          
          if (functionName === 'getForecast') {
            const forecast = await getForecast(context, location);
            messages.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: functionName,
              content: `
              Build forecast only for kiteable hours, include wind speed, gustyness, wave height and temp in your message. Gusty wind is not good for kiting. Don't respond without any numbers.
              Forecast: ${JSON.stringify(forecast)}`,
            } as ChatCompletionMessageParam);
          }
          // should be last as we include image as user msg to the end of tools calls
          // if (functionName === 'getSpotImages') {
          //   await bot.sendMessage(chatId, 'Дивлюсь камери 👀. Зачекай');
          //   images = await getSpotImages(context, functionArgs.location);
          //   messages.push({
          //     tool_call_id: toolCall.id,
          //     role: "tool",
          //     name: functionName,
          //     content: 'provided by user next',
          //   } as ChatCompletionMessageParam);

          //   messages.push({
          //     role: "user",
          //     content: [
          //       {
          //         type: 'text',
          //         text: 'Send responsse in JSON fromat: {message: string; bestScreenIndex: number}'
          //       },
          //       ...images.map(image => {
          //         return {
          //           type: "image_url",
          //           image_url: {
          //             "url": `data:image/jpeg;base64,${image.toString('base64')}`,
          //           }
          //         };
          //       })
          //     ],
          //   } as ChatCompletionMessageParam);
          //}
        }
        const secondResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
        });

        const msg = secondResponse.choices[0].message.content!;
        console.log(msg);

        if (msg[0] === '{') {
          const structedMessage: {message: string; bestScreenIndex: number} = JSON.parse(msg);
          await bot.sendPhoto(chatId, images[structedMessage.bestScreenIndex], {
            caption: structedMessage.message,
          });
        } else {
          await bot.sendMessage(chatId, msg);
        }

      }
    } catch (err) {
      const error = err as Error;
      await bot.sendMessage(chatId, `Error: ${error.message}\nStack trace:\n${error.stack}`);
    }
  });
});