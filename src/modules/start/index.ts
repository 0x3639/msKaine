import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../../context.js";
import { BOT_NAME } from "../../utils/constants.js";
import type { CommandCategory } from "../../docs/registry.js";
import { CATEGORIES } from "../../docs/registry.js";
import {
  buildCategoryIndex,
  buildCategoryKeyboard,
  buildCategoryDetail,
  buildCommandKeyboard,
  buildCommandDetail,
  lookupCommand,
  fuzzySearch,
} from "./help-builder.js";

const composer = new Composer<BotContext>();

// ─── /start ──────────────────────────────────────────────

composer.command("start", async (ctx) => {
  const name = ctx.from?.first_name ?? "there";
  const arg = (ctx.match as string).trim();

  // Deep link: /start help → show help
  if (arg === "help") {
    await ctx.reply(buildCategoryIndex(), {
      parse_mode: "HTML",
      reply_markup: buildCategoryKeyboard(),
    });
    return;
  }

  if (ctx.chat.type === "private") {
    await ctx.reply(
      `Hey ${name}! I'm <b>${BOT_NAME}</b>, a powerful group management bot.\n\n` +
        `Add me to a group and make me admin to get started!\n\n` +
        `Use /help to see what I can do.`,
      { parse_mode: "HTML" },
    );
  } else {
    await ctx.reply(
      `Hey ${name}! I'm alive and ready to help manage this group.\n` +
        `Use /help to see available commands.`,
      { parse_mode: "HTML" },
    );
  }
});

// ─── /help ───────────────────────────────────────────────

composer.command("help", async (ctx) => {
  const arg = (ctx.match as string).trim().toLowerCase();

  // No argument → category index
  if (!arg) {
    if (ctx.chat.type === "private") {
      await ctx.reply(buildCategoryIndex(), {
        parse_mode: "HTML",
        reply_markup: buildCategoryKeyboard(),
      });
    } else {
      await ctx.reply("Click the button below to see my full command list.", {
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
      });
    }
    return;
  }

  // /help <command> → per-command detail
  const entry = lookupCommand(arg);
  if (entry) {
    await ctx.reply(buildCommandDetail(entry), { parse_mode: "HTML" });
    return;
  }

  // Fuzzy fallback
  const suggestions = fuzzySearch(arg);
  if (suggestions.length > 0) {
    const list = suggestions.map((s) => `/${s.name}`).join(", ");
    await ctx.reply(
      `Command <code>/${arg}</code> not found. Did you mean: ${list}?`,
      { parse_mode: "HTML" },
    );
  } else {
    await ctx.reply(
      `Command <code>/${arg}</code> not found. Use /help to browse categories.`,
      { parse_mode: "HTML" },
    );
  }
});

// ─── Callback: category index ────────────────────────────

composer.callbackQuery("help:index", async (ctx) => {
  await ctx.editMessageText(buildCategoryIndex(), {
    parse_mode: "HTML",
    reply_markup: buildCategoryKeyboard(),
  });
  await ctx.answerCallbackQuery();
});

// ─── Callback: category detail ───────────────────────────

composer.callbackQuery(/^help:cat:(.+)$/, async (ctx) => {
  const category = ctx.match[1] as CommandCategory;

  if (!(category in CATEGORIES)) {
    await ctx.answerCallbackQuery({ text: "Unknown category." });
    return;
  }

  await ctx.editMessageText(buildCategoryDetail(category), {
    parse_mode: "HTML",
    reply_markup: buildCommandKeyboard(category),
  });
  await ctx.answerCallbackQuery();
});

// ─── Callback: command detail ────────────────────────────

composer.callbackQuery(/^help:cmd:(.+)$/, async (ctx) => {
  const name = ctx.match[1];
  const entry = lookupCommand(name);

  if (!entry) {
    await ctx.answerCallbackQuery({ text: "Command not found." });
    return;
  }

  const keyboard = new InlineKeyboard()
    .text("« Back to category", `help:cat:${entry.category}`)
    .row()
    .text("« All categories", "help:index");

  await ctx.editMessageText(buildCommandDetail(entry), {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
  await ctx.answerCallbackQuery();
});

export default composer;
