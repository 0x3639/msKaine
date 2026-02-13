import { InlineKeyboard } from "grammy";

/**
 * Parse Rose-style button syntax from message text.
 * [Button Text](buttonurl://https://example.com) -> new row
 * [Button Text](buttonurl://https://example.com:same) -> same row as previous
 * [Note Button](buttonurl://#notename) -> note link button
 *
 * Returns the cleaned text and an InlineKeyboard.
 */
export function parseButtons(text: string): {
  text: string;
  keyboard: InlineKeyboard | undefined;
} {
  const buttonRegex =
    /\[(.+?)\]\(buttonurl:\/\/(.+?)(?::same)?\)/g;
  const sameRowRegex = /\[(.+?)\]\(buttonurl:\/\/(.+?):same\)/;

  const buttons: Array<{ label: string; url: string; sameRow: boolean }> = [];
  let match: RegExpExecArray | null;

  // Use a fresh regex for extraction
  const extractRegex =
    /\[(.+?)\]\(buttonurl:\/\/(.+?)(?::same)?\)/g;
  while ((match = extractRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const label = match[1];
    const url = match[2];
    const isSameRow = sameRowRegex.test(fullMatch);
    buttons.push({ label, url, sameRow: isSameRow });
  }

  // Remove button syntax from text
  const cleanText = text.replace(buttonRegex, "").trim();

  if (buttons.length === 0) {
    return { text: cleanText, keyboard: undefined };
  }

  const keyboard = new InlineKeyboard();
  for (const button of buttons) {
    if (button.url.startsWith("#")) {
      // Note button - we'll handle this as a callback
      keyboard.text(button.label, `note:${button.url.slice(1)}`);
    } else {
      keyboard.url(button.label, button.url);
    }
    if (!button.sameRow) {
      keyboard.row();
    }
  }

  return { text: cleanText, keyboard };
}

/**
 * Escape HTML special characters for Telegram HTML parse mode.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Create a user mention link in HTML format.
 */
export function userMention(
  userId: number | bigint,
  name: string
): string {
  return `<a href="tg://user?id=${userId}">${escapeHtml(name)}</a>`;
}
