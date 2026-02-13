import { Api } from "grammy";
import { getDatabase } from "../core/database.js";
import { createChildLogger } from "../core/logger.js";

const log = createChildLogger("scheduler");

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the scheduled action processor.
 * Polls the database every 30 seconds for actions that need to be executed.
 */
export function startScheduler(api: Api): void {
  if (intervalId) return;

  log.info("Scheduler started");

  intervalId = setInterval(async () => {
    await processScheduledActions(api);
  }, 30_000);

  // Also run immediately on start
  processScheduledActions(api).catch((err) => {
    log.error({ err }, "Initial scheduler run failed");
  });
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    log.info("Scheduler stopped");
  }
}

async function processScheduledActions(api: Api): Promise<void> {
  const db = getDatabase();

  try {
    const actions = await db.scheduledAction.findMany({
      where: {
        completed: false,
        executeAt: { lte: new Date() },
      },
      take: 50,
      orderBy: { executeAt: "asc" },
    });

    for (const action of actions) {
      try {
        switch (action.actionType) {
          case "unban":
            if (action.userId) {
              await api.unbanChatMember(Number(action.chatId), Number(action.userId), {
                only_if_banned: true,
              });
              log.debug(
                { chatId: action.chatId, userId: action.userId },
                "Scheduled unban executed"
              );
            }
            break;

          case "unmute":
            if (action.userId) {
              await api.restrictChatMember(
                Number(action.chatId),
                Number(action.userId),
                {
                  can_send_messages: true,
                  can_send_audios: true,
                  can_send_documents: true,
                  can_send_photos: true,
                  can_send_videos: true,
                  can_send_video_notes: true,
                  can_send_voice_notes: true,
                  can_send_polls: true,
                  can_send_other_messages: true,
                  can_add_web_page_previews: true,
                }
              );
              log.debug(
                { chatId: action.chatId, userId: action.userId },
                "Scheduled unmute executed"
              );
            }
            break;

          case "captcha_kick":
            if (action.userId) {
              // Check if user is still pending (hasn't solved CAPTCHA)
              const pending = await db.captchaPending.findUnique({
                where: {
                  chatId_userId: {
                    chatId: action.chatId,
                    userId: action.userId,
                  },
                },
              });

              if (pending) {
                await api.banChatMember(Number(action.chatId), Number(action.userId));
                await api.unbanChatMember(Number(action.chatId), Number(action.userId), {
                  only_if_banned: true,
                });

                // Delete the CAPTCHA message
                if (pending.messageId) {
                  try {
                    await api.deleteMessage(Number(action.chatId), pending.messageId);
                  } catch { /* ignore */ }
                }

                // Clean up pending record
                await db.captchaPending.delete({
                  where: { id: pending.id },
                });

                log.debug(
                  { chatId: action.chatId, userId: action.userId },
                  "CAPTCHA kick executed"
                );
              }
            }
            break;

          case "antiraid_disable":
            await db.chat.update({
              where: { id: action.chatId },
              data: { antiraidEnabled: false, antiraidExpiresAt: null },
            });
            log.debug({ chatId: action.chatId }, "Antiraid auto-disabled");
            break;

          default:
            log.warn({ actionType: action.actionType }, "Unknown scheduled action type");
        }

        // Mark as completed
        await db.scheduledAction.update({
          where: { id: action.id },
          data: { completed: true },
        });
      } catch (err) {
        log.error(
          { err, actionId: action.id, actionType: action.actionType },
          "Failed to execute scheduled action"
        );

        // Mark as completed even on failure to prevent infinite retries
        await db.scheduledAction.update({
          where: { id: action.id },
          data: { completed: true },
        });
      }
    }
  } catch (err) {
    log.error({ err }, "Scheduler processing failed");
  }
}
