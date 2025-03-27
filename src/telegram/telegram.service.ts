import { Observation, Spot } from '@app/mongodb/types';
import { PROMPT } from '@app/openai/consts';
import { Inject, Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';
import fs from 'fs/promises';
import { ChatCompletionMessageParam } from 'openai/resources';
import { startCase } from 'lodash';
import { availableSpots, Locations } from '@app/config';
import { BrowserService } from '@app/browser/browser.service';
import { SpotService } from '@app/spot/spot.service';
import { VisionService } from '@app/vision/vision.service';
import { SettingsService } from '@app/settings/settings.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TelegramService {
  constructor(
    @Inject('OPENAI') private readonly openai: OpenAI,
    @Inject('TELEGRAM_BOT') private readonly bot: TelegramBot,
    private readonly browserService: BrowserService,
    private readonly spotService: SpotService,
    private readonly visionService: VisionService,
    private readonly settingsService: SettingsService,
  ) {
    bot.setMyCommands([{ command: 'check', description: 'Check some spot' }]);
    this.bot.on('message', this.processMessage.bind(this));
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleStateChange() {
    const { enabled } = await this.settingsService.getSettings();
    if (enabled && !this.bot.isPolling()) {
      await this.bot.startPolling();
    } else {
      await this.bot.stopPolling();
    }
  }

  public shouldReply(msg: TelegramBot.Message) {
    if (
      msg.text?.includes(process.env.TELEGRAM_BOT_NAME!) ||
      msg.chat.type === 'private' ||
      msg.reply_to_message?.from?.username ===
        process.env.TELEGRAM_BOT_NAME!.slice(1)
    ) {
      return true;
    }
    return false;
  }

  public async messageAboutKiters(spot: Spot, result: Observation) {
    const image = await fs.readFile(result.analyzedFile);
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'assistant',
          content: `${PROMPT}. You will be given information about the kiters on the spot ${spot.name}. Make your conclusion about given data. No data means kiters weren't detected on the spot.`,
        },
        { role: 'user', content: JSON.stringify(result.matches) },
      ],
    });
    const responseMessage = response.choices[0].message!;

    const settings = await this.settingsService.getSettings();
    const subscribedChats = settings.subscribedChats;
    for (const chatId of subscribedChats) {
      await this.bot.sendPhoto(chatId, image, {
        caption: responseMessage.content!,
      });
    }
  }

  async processCommand(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (text.startsWith('/check')) {
      // TODO: refactor
      const param = text.split(' ').slice(1).join(' '); // Extract parameters after the command
      if (param) {
        const spot = await this.spotService.getSpotByName(param);
        if (!spot) {
          this.bot.sendMessage(chatId, `Spot ${param} not found`);
          return true;
        }
        const imagePath = await this.browserService.getSpotImages({
          spot,
          amount: 1,
        });
        const result = await this.visionService.analyzeImage(imagePath[0]);
        await this.messageAboutKiters(spot, result);
      } else {
        this.bot.sendMessage(chatId, 'Usage: /check <spot>');
      }
      return true;
    }
    if (text.startsWith('/enableWatch')) {
      await this.settingsService.toggleSubscribedChat(chatId, true);
      this.bot.sendMessage(chatId, 'Тепер всі апдейти про споти будуть приходити сюди 😎 🚀');
      return true;
    }
    if (text.startsWith('/disableWatch')) {
      await this.settingsService.toggleSubscribedChat(chatId, false);
      this.bot.sendMessage(chatId, 'Тепер всі апдейти про споти не будуть приходити сюди 😢');
      return true;
    }
    if (text.startsWith('/halt')) {
      await this.settingsService.update({ enabled: false });
      this.bot.sendMessage(chatId, 'Pulling the plug on the bot... 🔌');
      return true;
    }
    return false;
  }

  async processMessage(msg: TelegramBot.Message) {
    const chatId: number = msg.chat.id;
    try {
      if (!this.shouldReply(msg)) {
        return;
      }

      const isCommandHandled = await this.processCommand(msg);
      if (isCommandHandled) {
        return;
      }

      const currentDate = new Date().toISOString();

      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: `${PROMPT} Today: ${currentDate}.` }],
        },
      ];

      if (msg.reply_to_message) {
        if (
          msg.reply_to_message.from?.username ===
          process.env.TELEGRAM_BOT_NAME!.slice(1)
        ) {
          messages.push({
            role: 'assistant',
            content: msg.reply_to_message.text || msg.reply_to_message.caption,
          });
        } else {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${msg.reply_to_message.from?.first_name}: ${msg.reply_to_message.text!}`,
              },
            ],
          });
        }
      }

      messages.push({
        role: 'user',
        content: [{ type: 'text', text: msg.text! }],
      });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        tools: [
          {
            type: 'function',
            function: {
              name: 'getForecast',
              description: 'Get forecast for the given spot.',
              parameters: {
                type: 'object',
                properties: {
                  location: {
                    type: 'string',
                    description: 'The spot name',
                  },
                  unit: { type: 'string', enum: Object.keys(availableSpots) },
                },
                required: ['location'],
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
        await this.bot.sendMessage(chatId, responseMessage.content);
      }

      if (toolCalls) {
        console.log('Got tools call', toolCalls);
        messages.push(responseMessage); // extend conversation with assistant's reply
        const images: Buffer[] = [];
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name as
            | 'getForecast'
            | 'getSpotImages';
          const functionArgs = JSON.parse(toolCall.function.arguments);

          //   const location = startCase(functionArgs.location) as Locations;

          //   if (functionName === 'getForecast') {
          //     const forecast = await this.browserService.getForecast(location);
          //     messages.push({
          //       tool_call_id: toolCall.id,
          //       role: 'tool',
          //       name: functionName,
          //       content: `
          //       Build forecast only for kiteable hours, include wind speed, gustyness, wave height and temp in your message. Gusty wind is not good for kiting. Don't respond without any numbers.
          //       Forecast: ${JSON.stringify(forecast)}`,
          //     } as ChatCompletionMessageParam);
          //   }
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
        const secondResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
        });

        const msg = secondResponse.choices[0].message.content!;
        console.log(msg);

        if (msg[0] === '{') {
          const structedMessage: {
            message: string;
            bestScreenIndex: number;
          } = JSON.parse(msg);
          await this.bot.sendPhoto(
            chatId,
            images[structedMessage.bestScreenIndex],
            {
              caption: structedMessage.message,
            },
          );
        } else {
          await this.bot.sendMessage(chatId, msg);
        }
      }
    } catch (err) {
      const error = err as Error;
      await this.bot.sendMessage(
        chatId,
        `Error: ${error.message}\nStack trace:\n${error.stack}`,
      );
    }
  }
}
