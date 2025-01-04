import TelegramBot from "node-telegram-bot-api";
import fs from "fs/promises";
import { Observation } from "../types";
import { openai, PROMPT } from "../index";

export const shouldReply = (msg: TelegramBot.Message) => {
if (msg.text?.includes(process.env.TELEGRAM_BOT_NAME!) 
    || msg.chat.type === 'private' 
    || msg.reply_to_message?.from?.username === process.env.TELEGRAM_BOT_NAME!.slice(1)
) {
    return true;
}
return false;
}

export const messageMeAboutKiters = async(result: Observation, bot: TelegramBot) => {
    const image = await fs.readFile(result.file);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "assistant", content: `${PROMPT}. You will be given information about the kiters on the spot ${result.spot}. Make your conclusion about given data. No data means kiters weren't detected on the spot.` },
        { role: "user", content: JSON.stringify(result.matches) },
      ],
    });
    const responseMessage = response.choices[0].message!;

    // TODO: replce chatId with your chat id
    await bot.sendPhoto(90780619, image, {
      caption: responseMessage.content!,
    });
}