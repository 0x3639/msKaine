import { loadConfig } from "./config.js";
import { createBot } from "./bot.js";
import { getDatabase, disconnectDatabase } from "./core/database.js";
import { connectRedis, disconnectRedis } from "./core/redis.js";
import { initializeZenon, disconnectZenon } from "./core/zenon-client.js";
import { startScheduler, stopScheduler } from "./services/scheduler.service.js";
import { logger } from "./core/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info({ env: config.NODE_ENV }, "Starting Mr. Kaine Admin Bot...");

  // Initialize database
  const db = getDatabase();
  await db.$connect();
  logger.info("Database connected");

  // Initialize Redis
  await connectRedis();

  // Initialize Zenon SDK (non-blocking - bot works without it)
  await initializeZenon(config.ZENON_NODE_HTTP, config.ZENON_MNEMONIC);

  // Create and start the bot
  const bot = createBot(config.BOT_TOKEN);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");
    stopScheduler();
    bot.stop();
    await disconnectZenon();
    await disconnectRedis();
    await disconnectDatabase();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Start long polling
  await bot.start({
    onStart: (botInfo) => {
      logger.info(
        { username: botInfo.username, id: botInfo.id },
        "Bot started successfully"
      );

      // Start the scheduler for temp bans/mutes, CAPTCHA kicks, etc.
      startScheduler(bot.api);
    },
  });
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal error during startup");
  process.exit(1);
});
