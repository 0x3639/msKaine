import { escapeHtml, userMention } from "../../utils/message-builder.js";

export interface FillingContext {
  user?: {
    id: number | bigint;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chatTitle?: string;
  rules?: string;
}

/**
 * Apply filling replacements to a template string.
 * Supported fillings: {first}, {last}, {fullname}, {username}, {mention}, {id},
 * {chatname}, {rules}, {preview}, {nonotif}, {protect}, {mediaspoiler}
 *
 * Control fillings ({preview}, {nonotif}, {protect}, {mediaspoiler}) are stripped
 * from the text and returned as flags.
 */
export function applyFillings(
  template: string,
  context: FillingContext
): { text: string; noPreview: boolean; noNotif: boolean; protect: boolean; mediaSpoiler: boolean } {
  let result = template;
  const user = context.user;

  // Control fillings (extract and strip)
  const noPreview = /\{preview\}/i.test(result);
  const noNotif = /\{nonotif\}/i.test(result);
  const protect = /\{protect\}/i.test(result);
  const mediaSpoiler = /\{mediaspoiler\}/i.test(result);

  result = result.replace(/\{preview\}/gi, "");
  result = result.replace(/\{nonotif\}/gi, "");
  result = result.replace(/\{protect\}/gi, "");
  result = result.replace(/\{mediaspoiler\}/gi, "");

  if (user) {
    result = result.replace(/\{first\}/gi, escapeHtml(user.first_name));
    result = result.replace(/\{last\}/gi, escapeHtml(user.last_name ?? ""));
    result = result.replace(
      /\{fullname\}/gi,
      escapeHtml(`${user.first_name} ${user.last_name ?? ""}`.trim())
    );
    result = result.replace(
      /\{username\}/gi,
      user.username
        ? `@${escapeHtml(user.username)}`
        : userMention(user.id, user.first_name)
    );
    result = result.replace(/\{mention\}/gi, userMention(user.id, user.first_name));
    result = result.replace(/\{id\}/gi, String(user.id));
  }

  result = result.replace(/\{chatname\}/gi, escapeHtml(context.chatTitle ?? "this group"));
  result = result.replace(/\{rules\}/gi, escapeHtml(context.rules ?? "No rules set."));

  return { text: result.trim(), noPreview, noNotif, protect, mediaSpoiler };
}
