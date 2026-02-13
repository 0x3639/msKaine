/**
 * If a message contains the %%% separator, pick a random section.
 * This allows multiple variations of the same note/filter/welcome.
 */
export function pickRandom(content: string): string {
  if (!content.includes("%%%")) return content;

  const parts = content.split("%%%").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return content;

  const idx = Math.floor(Math.random() * parts.length);
  return parts[idx];
}
