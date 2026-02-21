/**
 * Generates command reference markdown pages from the command registry.
 * Output goes to docs/commands/ — one file per category plus an index.
 *
 * Usage: npx tsx scripts/generate-docs.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  COMMAND_REGISTRY,
  CATEGORIES,
  formatPermission,
  type CommandCategory,
  type CommandEntry,
} from "../src/docs/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, "../docs/commands");

mkdirSync(DOCS_DIR, { recursive: true });

function generateCategoryPage(
  categoryKey: string,
  meta: (typeof CATEGORIES)[CommandCategory],
  commands: CommandEntry[],
): string {
  let md = `# ${meta.icon} ${meta.label}\n\n`;
  md += `${meta.description}\n\n`;
  md += `> ${commands.length} commands in this category\n\n`;

  for (const cmd of commands) {
    md += `## /${cmd.name}\n\n`;
    md += `${cmd.longDescription ?? cmd.description}\n\n`;
    md += `| | |\n|---|---|\n`;
    md += `| **Permission** | ${formatPermission(cmd.permission)} |\n`;
    md += `| **Usage** | \`${cmd.usage}\` |\n`;
    md += `| **Module** | ${cmd.module} |\n\n`;

    if (cmd.examples.length > 0) {
      md += `**Examples:**\n\n`;
      for (const ex of cmd.examples) {
        md += `- \`${ex}\`\n`;
      }
      md += "\n";
    }

    if (cmd.notes && cmd.notes.length > 0) {
      md += `::: tip\n`;
      for (const note of cmd.notes) {
        md += `${note}\n`;
      }
      md += `:::\n\n`;
    }

    md += "---\n\n";
  }

  return md;
}

function generateIndex(): string {
  let md = `# Command Reference\n\n`;
  md += `Mr. Kaine has **${COMMAND_REGISTRY.length} commands** across ${Object.keys(CATEGORIES).length} categories.\n\n`;
  md += `Use \`/help\` in Telegram for interactive command browsing, or explore the categories below.\n\n`;

  for (const [key, meta] of Object.entries(CATEGORIES)) {
    const count = COMMAND_REGISTRY.filter((c) => c.category === key).length;
    md += `## ${meta.icon} [${meta.label}](./${key})\n\n`;
    md += `${meta.description} — ${count} commands\n\n`;
  }

  return md;
}

// Generate category pages
for (const [key, meta] of Object.entries(CATEGORIES)) {
  const commands = COMMAND_REGISTRY.filter((c) => c.category === key);
  const content = generateCategoryPage(key, meta, commands);
  const filePath = join(DOCS_DIR, `${key}.md`);
  writeFileSync(filePath, content);
  console.log(`Generated ${filePath} (${commands.length} commands)`);
}

// Generate index
const indexPath = join(DOCS_DIR, "index.md");
writeFileSync(indexPath, generateIndex());
console.log(`Generated ${indexPath}`);

console.log(
  `\nDone! ${COMMAND_REGISTRY.length} commands across ${Object.keys(CATEGORIES).length} categories.`,
);
