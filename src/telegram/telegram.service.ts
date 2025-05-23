import { Observation, Spot } from '@app/mongodb/types';
import { PROMPT } from '@app/openai/consts';
import { Inject, Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';
import fs from 'fs/promises';
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources';
import { BrowserService } from '@app/browser/browser.service';
import { SpotService } from '@app/spot/spot.service';
import { VisionService } from '@app/vision/vision.service';
import { SettingsService } from '@app/settings/settings.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ForecastService } from '@app/forecast/forecast.service';

@Injectable()
export class TelegramService {
  constructor(
    @Inject('OPENAI') private readonly openai: OpenAI,
    @Inject('TELEGRAM_BOT') private readonly bot: TelegramBot,
    private readonly browserService: BrowserService,
    private readonly spotService: SpotService,
    private readonly visionService: VisionService,
    private readonly settingsService: SettingsService,
    private readonly forecastService: ForecastService,
  ) {
    bot.setMyCommands([
      { command: 'watch', description: 'Включити сповіщення про споти' },
      { command: 'nowatch', description: 'Виключити сповіщення про споти' },
    ]);
    this.bot.on('message', this.processMessage.bind(this));
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleStateChange() {
    const { enabled } = await this.settingsService.getSettings();
    const isPolling = this.bot.isPolling();
    if (enabled && !isPolling) {
      console.log('Starting telegram bot polling');
      await this.bot.startPolling();
    } else if (!enabled && isPolling) {
      console.log('Stopping telegram bot polling');
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

  public async messageAboutKiters(
    spot: Spot,
    result: Observation,
    chatIds: number[],
  ) {
    const image = await fs.readFile(result.analyzedFile);
    const forecast = await this.forecastService.getTodayForecastItems(
      spot.name,
    );
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'assistant',
          content: `${PROMPT}. You will be given information about the kiters on the spot ${spot.name} and the forecast for the today. Make your conclusion about given data. No data means kiters weren't detected on the spot.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            state: result.matches.filter((el) => el.label === 'kite'),
            forecast,
          }),
        },
      ],
    });
    const responseMessage = response.choices[0].message!;

    for (const chatId of chatIds) {
      await this.bot.sendPhoto(chatId, image, {
        caption: responseMessage.content!,
      });
    }
  }

  async processCommand(msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    if (text.startsWith('/watch')) {
      await this.settingsService.toggleSubscribedChat(chatId, true);
      this.bot.sendMessage(
        chatId,
        'Тепер всі апдейти про споти будуть приходити сюди 😎 🚀',
      );
      return true;
    }
    if (text.startsWith('/nowatch')) {
      await this.settingsService.toggleSubscribedChat(chatId, false);
      this.bot.sendMessage(
        chatId,
        'Тепер всі апдейти про споти не будуть приходити сюди 😢',
      );
      return true;
    }
    if (text.startsWith('/halt')) {
      await this.settingsService.update({ enabled: false });
      this.bot.sendMessage(chatId, 'Pulling the plug on the bot... 🔌');
      return true;
    }
    return false;
  }

  async getAvaialbeTools(): Promise<ChatCompletionTool[]> {
    const spots = await this.spotService.getAllSpots();
    const spotNames = spots.map((spot) => spot.name);
    return [
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
              unit: { type: 'string', enum: spotNames },
            },
            required: ['location'],
          },
        },
      },
      // should be last
      {
        type: 'function',
        function: {
          name: 'getSpotImages',
          description:
            'Get live image from the spot. Look at the spot and tell me whehter you see kitesurfers or not.',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The spot name',
              },
              unit: { type: 'string', enum: spotNames },
            },
            required: ['location'],
          },
        },
      },
    ];
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
        tools: await this.getAvaialbeTools(),
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
        let analyzedFile = null;
        for (const toolCall of toolCalls) {
          const functionName = toolCall.function.name as
            | 'getForecast'
            | 'getSpotImages';
          const functionArgs = JSON.parse(toolCall.function.arguments);

          if (functionName === 'getForecast') {
            const forecast = await this.forecastService.getTodayForecastItems(
              functionArgs.location,
            );
            messages.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: functionName,
              content: `
                Build forecast only for kiteable hours, include wind speed, gustyness, wave height and temp in your message. Gusty wind is not good for kiting. Don't respond without any numbers.
                Forecast: ${JSON.stringify(forecast)}`,
            } as ChatCompletionMessageParam);
          }
          // should be last as we include image as user msg to the end of tools calls
          if (functionName === 'getSpotImages') {
            const spot = await this.spotService.getSpotByName(
              functionArgs.location,
            );
            const images = await this.browserService.getSpotImages({
              spot,
              amount: 1,
            });
            const spotData = await this.visionService.analyzeImage(images[0]);
            analyzedFile = spotData.analyzedFile;
            messages.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: functionName,
              content: JSON.stringify(spotData.matches),
            } as ChatCompletionMessageParam);
          }
        }
        const secondResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: messages,
        });

        const msg = secondResponse.choices[0].message.content!;
        console.log(msg);
        if (analyzedFile) {
          const image = await fs.readFile(analyzedFile);
          await this.bot.sendPhoto(chatId, image, {
            caption: msg,
          });
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
