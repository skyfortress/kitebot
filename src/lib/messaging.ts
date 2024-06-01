import TelegramBot from "node-telegram-bot-api";

export const shouldReply = (msg: TelegramBot.Message) => {
if (msg.text?.includes(process.env.TELEGRAM_BOT_NAME!) 
    || msg.chat.type === 'private' 
    || msg.reply_to_message?.from?.username === process.env.TELEGRAM_BOT_NAME!.slice(1)
) {
    return true;
}
return false;
}