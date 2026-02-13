import { session } from "grammy";
import type { BotContext, SessionData } from "../context.js";

export function sessionMiddleware() {
  return session<SessionData, BotContext>({
    initial: (): SessionData => ({}),
  });
}
