import { InlineKeyboard } from "grammy";
import {
  COMMAND_REGISTRY,
  CATEGORIES,
  getCommand,
  getCommandsByCategory,
  searchCommands,
  formatPermission,
  type CommandCategory,
  type CommandEntry,
} from "../../docs/registry.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { BOT_NAME } from "../../utils/constants.js";

/**
 * Build the top-level category index message.
 */
export function buildCategoryIndex(): string {
  let text = `<b>${escapeHtml(BOT_NAME)} — Command Help</b>\n\n`;
  text += `Choose a category below to browse commands, or use <code>/help &lt;command&gt;</code> to look up a specific command.\n\n`;

  for (const [key, meta] of Object.entries(CATEGORIES)) {
    const count = getCommandsByCategory(key as CommandCategory).length;
    text += `${meta.icon} <b>${escapeHtml(meta.label)}</b> — ${count} commands\n`;
  }

  text += `\n<i>Total: ${COMMAND_REGISTRY.length} commands</i>`;
  return text;
}

/**
 * Build the inline keyboard for category selection.
 */
export function buildCategoryKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const entries = Object.entries(CATEGORIES);

  for (let i = 0; i < entries.length; i++) {
    const [key, meta] = entries[i];
    kb.text(`${meta.icon} ${meta.label}`, `help:cat:${key}`);
    if (i % 2 === 1) kb.row();
  }

  return kb;
}

/**
 * Build the detail view for a single category.
 */
export function buildCategoryDetail(category: CommandCategory): string {
  const meta = CATEGORIES[category];
  const commands = getCommandsByCategory(category);

  let text = `${meta.icon} <b>${escapeHtml(meta.label)}</b>\n`;
  text += `<i>${escapeHtml(meta.description)}</i>\n\n`;

  for (const cmd of commands) {
    const perm =
      cmd.permission === "everyone" ? "" : ` [${formatPermission(cmd.permission)}]`;
    text += `/${cmd.name}${perm} — ${escapeHtml(cmd.description)}\n`;
  }

  text += `\n<i>Tap a command below for details.</i>`;

  // Telegram has a 4096 char limit — truncate if needed
  if (text.length > 4000) {
    text = text.slice(0, 3950) + "\n\n<i>... and more. Use /help &lt;command&gt;</i>";
  }

  return text;
}

/**
 * Build the inline keyboard for commands within a category.
 * Shows up to 24 commands (8 rows of 3).
 */
export function buildCommandKeyboard(
  category: CommandCategory,
): InlineKeyboard {
  const commands = getCommandsByCategory(category);
  const kb = new InlineKeyboard();

  const maxButtons = 24;
  const shown = commands.slice(0, maxButtons);

  for (let i = 0; i < shown.length; i++) {
    kb.text(`/${shown[i].name}`, `help:cmd:${shown[i].name}`);
    if (i % 3 === 2) kb.row();
  }

  kb.row();
  kb.text("« Back to categories", "help:index");

  return kb;
}

/**
 * Build the detailed view for a single command.
 */
export function buildCommandDetail(entry: CommandEntry): string {
  let text = `<b>/${escapeHtml(entry.name)}</b> — ${escapeHtml(entry.description)}\n\n`;

  if (entry.longDescription) {
    text += `${escapeHtml(entry.longDescription)}\n\n`;
  }

  text += `<b>Permission:</b> ${formatPermission(entry.permission)}\n`;
  text += `<b>Category:</b> ${CATEGORIES[entry.category].icon} ${CATEGORIES[entry.category].label}\n\n`;
  text += `<b>Usage:</b> <code>${escapeHtml(entry.usage)}</code>\n`;

  if (entry.examples.length > 0) {
    text += `\n<b>Examples:</b>\n`;
    for (const ex of entry.examples) {
      text += `• <code>${escapeHtml(ex)}</code>\n`;
    }
  }

  if (entry.notes && entry.notes.length > 0) {
    text += `\n<b>Notes:</b>\n`;
    for (const note of entry.notes) {
      text += `• ${escapeHtml(note)}\n`;
    }
  }

  return text;
}

/**
 * Look up a command, returning the entry or undefined.
 */
export function lookupCommand(name: string): CommandEntry | undefined {
  return getCommand(name);
}

/**
 * Search for commands matching a query.
 */
export function fuzzySearch(query: string): CommandEntry[] {
  return searchCommands(query);
}
