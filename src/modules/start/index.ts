import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { BOT_NAME } from "../../utils/constants.js";

const composer = new Composer<BotContext>();

composer.command("start", async (ctx) => {
  const name = ctx.from?.first_name ?? "there";

  if (ctx.chat.type === "private") {
    await ctx.reply(
      `Hey ${name}! I'm <b>${BOT_NAME}</b>, a powerful group management bot.\n\n` +
        `Add me to a group and make me admin to get started!\n\n` +
        `Use /help to see what I can do.`,
      { parse_mode: "HTML" }
    );
  } else {
    await ctx.reply(
      `Hey ${name}! I'm alive and ready to help manage this group.\n` +
        `Use /help to see available commands.`,
      { parse_mode: "HTML" }
    );
  }
});

composer.command("help", async (ctx) => {
  const helpText = `<b>${BOT_NAME} - Help</b>\n\n` +
    `<b>Moderation</b>\n` +
    `/ban /tban /dban /sban /unban - Ban management\n` +
    `/mute /tmute /dmute /smute /unmute - Mute management\n` +
    `/kick /dkick /skick - Kick users\n` +
    `/warn /dwarn /swarn /rmwarn /resetwarn - Warnings\n` +
    `/promote /demote /adminlist - Admin management\n` +
    `/del /purge /spurge - Message deletion\n\n` +
    `<b>Anti-Spam</b>\n` +
    `/lock /unlock /locks - Content locks\n` +
    `/captcha - CAPTCHA verification\n` +
    `/blocklist /addblocklist - Word blocklist\n` +
    `/setflood /antiraid - Flood/raid protection\n\n` +
    `<b>Greetings</b>\n` +
    `/welcome /setwelcome - Welcome messages\n` +
    `/goodbye /setgoodbye - Goodbye messages\n\n` +
    `<b>Content</b>\n` +
    `/rules /setrules - Group rules\n` +
    `/save /get /notes - Notes system\n` +
    `/filter /filters /stop - Auto-reply filters\n\n` +
    `<b>Federations</b>\n` +
    `/newfed /joinfed /fban - Federation system\n\n` +
    `<b>Zenon Network</b>\n` +
    `/zbalance /zstats /zpillars - Blockchain queries\n` +
    `/zwallet /zsend /zstake - Wallet operations\n` +
    `/zgate - Token-gated access\n\n` +
    `<b>Settings</b>\n` +
    `/setlog - Action logging\n` +
    `/cleancommand /cleanservice - Auto-cleaning\n` +
    `/connect - PM management\n` +
    `/disable /enable - Command toggling\n\n` +
    `<b>Other</b>\n` +
    `/id /info - User/chat info\n` +
    `/echo - Repeat a message\n` +
    `/approve - Approve users\n` +
    `/pin /unpin - Pin management\n\n` +
    `<i>For detailed help on any command, use the command without arguments.</i>`;

  if (ctx.chat.type === "private") {
    await ctx.reply(helpText, { parse_mode: "HTML" });
  } else {
    // In groups, send a brief message and offer PM details
    await ctx.reply(
      `Click the button below to see my full command list.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Help",
                url: `https://t.me/${ctx.me.username}?start=help`,
              },
            ],
          ],
        },
      }
    );
  }
});

export default composer;
