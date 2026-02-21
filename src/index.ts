import http from "node:http";
import { loadConfig } from "./config.js";
import { createBot } from "./bot.js";
import { getDatabase, disconnectDatabase } from "./core/database.js";
import { connectRedis, disconnectRedis, getRedis } from "./core/redis.js";
import { initializeZenon, disconnectZenon, getZenonClient } from "./core/zenon-client.js";
import { startScheduler, stopScheduler } from "./services/scheduler.service.js";
import { logger } from "./core/logger.js";

let healthServer: http.Server | null = null;
const startTime = Date.now();

function startHealthServer(port: number): void {
  healthServer = http.createServer(async (_req, res) => {
    const dbOk = await checkDatabase();
    const redisOk = await checkRedis();
    const zenonOk = checkZenon();

    const allOk = dbOk && redisOk;
    const status = allOk ? "ok" : "degraded";

    res.writeHead(allOk ? 200 : 503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        database: dbOk,
        redis: redisOk,
        zenon: zenonOk,
      })
    );
  });

  healthServer.listen(port, () => {
    logger.info({ port }, "Health check server started");
  });
}

async function checkDatabase(): Promise<boolean> {
  try {
    const db = getDatabase();
    await db.$queryRawUnsafe("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

function checkZenon(): boolean {
  try {
    const client = getZenonClient();
    return client.initialized;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info({ env: config.NODE_ENV }, "Starting Ms. Kaine Admin Bot...");

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

  // Start health check server if configured
  if (config.HEALTH_PORT > 0) {
    startHealthServer(config.HEALTH_PORT);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");
    if (healthServer) {
      healthServer.close();
    }
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
