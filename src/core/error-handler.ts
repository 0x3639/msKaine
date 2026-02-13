import { BotError, GrammyError, HttpError } from "grammy";
import { logger } from "./logger.js";
import type { BotContext } from "../context.js";

const log = logger.child({ module: "error-handler" });

export function handleError(err: BotError<BotContext>): void {
  const ctx = err.ctx;
  const e = err.error;

  const errorContext = {
    updateId: ctx.update.update_id,
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
  };

  if (e instanceof GrammyError) {
    log.error({ ...errorContext, description: e.description, code: e.error_code }, "Telegram API error");
  } else if (e instanceof HttpError) {
    log.error({ ...errorContext, err: e }, "HTTP error communicating with Telegram");
  } else {
    log.error({ ...errorContext, err: e }, "Unhandled error in update handler");
  }
}
