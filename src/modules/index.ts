import type { Bot } from "grammy";
import type { BotContext } from "../context.js";
import { createChildLogger } from "../core/logger.js";

import startModule from "./start/index.js";
import adminModule from "./admin/index.js";
import bansModule from "./bans/index.js";
import warningsModule from "./warnings/index.js";
import reportsModule from "./reports/index.js";
import purgesModule from "./purges/index.js";
import logChannelsModule from "./log-channels/index.js";
import pinsModule from "./pins/index.js";
import approvalsModule from "./approvals/index.js";
import disablingModule from "./disabling/index.js";
import locksModule from "./locks/index.js";
import captchaModule from "./captcha/index.js";
import blocklistModule from "./blocklist/index.js";
import antifloodModule from "./antiflood/index.js";
import antiraidModule from "./antiraid/index.js";
import greetingsModule from "./greetings/index.js";
import rulesModule from "./rules/index.js";
import notesModule from "./notes/index.js";
import filtersModule from "./filters/index.js";
import connectionsModule from "./connections/index.js";
import echoModule from "./echo/index.js";
import cleaningModule from "./cleaning/index.js";
import infoModule from "./info/index.js";
import federationsModule from "./federations/index.js";
import zenonModule from "./zenon/index.js";

const log = createChildLogger("modules");

/**
 * Register all feature modules with the bot.
 * Order matters - modules are checked in registration order.
 */
export function registerModules(bot: Bot<BotContext>): void {
  // Core commands (start, help)
  bot.use(startModule);

  // Moderation modules
  bot.use(adminModule);
  bot.use(bansModule);
  bot.use(warningsModule);
  bot.use(reportsModule);
  bot.use(purgesModule);
  bot.use(logChannelsModule);
  bot.use(pinsModule);
  bot.use(approvalsModule);
  bot.use(disablingModule);

  // Anti-spam modules
  bot.use(locksModule);
  bot.use(captchaModule);
  bot.use(blocklistModule);
  bot.use(antifloodModule);
  bot.use(antiraidModule);
  bot.use(greetingsModule);

  // Content & feature modules
  bot.use(rulesModule);
  bot.use(notesModule);
  bot.use(filtersModule);
  bot.use(connectionsModule);
  bot.use(echoModule);
  bot.use(cleaningModule);
  bot.use(infoModule);
  bot.use(federationsModule);

  // Zenon blockchain integration
  bot.use(zenonModule);

  log.info("All modules registered");
}
