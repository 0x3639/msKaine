import { PrismaClient } from "@prisma/client";
import { getConfig } from "../config.js";
import { logger } from "./logger.js";

let prisma: PrismaClient | null = null;

export function getDatabase(): PrismaClient {
  if (!prisma) {
    const config = getConfig();
    prisma = new PrismaClient({
      log:
        config.NODE_ENV === "development"
          ? [
              { level: "query", emit: "event" },
              { level: "error", emit: "stdout" },
            ]
          : [{ level: "error", emit: "stdout" }],
    });

    if (config.NODE_ENV === "development") {
      prisma.$on("query" as never, (e: { query: string; duration: number }) => {
        logger.debug({ query: e.query, duration: e.duration }, "prisma query");
      });
    }
  }
  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
