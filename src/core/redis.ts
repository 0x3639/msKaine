import { Redis } from "ioredis";
import { getConfig } from "../config.js";
import { logger } from "./logger.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const config = getConfig();
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });

    redis.on("connect", () => {
      logger.info("Redis connected");
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  await client.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
