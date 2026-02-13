import { Composer } from "grammy";
import type { BotContext } from "../../context.js";
import { escapeHtml } from "../../utils/message-builder.js";
import { requireZenon, formatAmount } from "./zenon.service.js";
import { createChildLogger } from "../../core/logger.js";

const log = createChildLogger("zenon:accelerator");

const composer = new Composer<BotContext>();

// /zproposals [page] - List Accelerator-Z proposals
composer.command("zproposals", async (ctx) => {
  if (!requireZenon(ctx)) return;

  try {
    const page = parseInt((ctx.match as string).trim(), 10) || 0;
    const result = await ctx.zenon.embedded.accelerator.getAll(page, 10);

    if (!result || !result.list || result.list.length === 0) {
      await ctx.reply("No proposals found.");
      return;
    }

    let text = `<b>Accelerator-Z Proposals (page ${page}, total: ${result.count}):</b>\n\n`;

    for (const project of result.list) {
      const znnNeeded = formatAmount(project.znnFundsNeeded ?? 0);
      const qsrNeeded = formatAmount(project.qsrFundsNeeded ?? 0);
      text += `<b>${escapeHtml(project.name ?? "Untitled")}</b>\n`;
      text += `  ID: <code>${project.id}</code>\n`;
      text += `  Status: <b>${project.status ?? "N/A"}</b>\n`;
      text += `  Funds: ${znnNeeded} ZNN / ${qsrNeeded} QSR\n\n`;
    }

    if (result.count > (page + 1) * 10) {
      text += `Next page: /zproposals ${page + 1}`;
    }

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err }, "Failed to list proposals");
    await ctx.reply("Failed to fetch proposals.");
  }
});

// /zproposal <id> - Get proposal details
composer.command("zproposal", async (ctx) => {
  if (!requireZenon(ctx)) return;

  const projectId = (ctx.match as string).trim();
  if (!projectId) {
    await ctx.reply("Usage: /zproposal <project_id>");
    return;
  }

  try {
    const project = await ctx.zenon.embedded.accelerator.getProjectById(projectId);

    if (!project) {
      await ctx.reply("Proposal not found.");
      return;
    }

    let text = `<b>Proposal: ${escapeHtml(project.name ?? "Untitled")}</b>\n\n`;
    text += `ID: <code>${project.id}</code>\n`;
    text += `Owner: <code>${project.owner}</code>\n`;
    text += `Status: <b>${project.status ?? "N/A"}</b>\n`;
    text += `URL: ${project.url ? escapeHtml(project.url) : "N/A"}\n\n`;
    text += `<b>Funding:</b>\n`;
    text += `  ZNN needed: <b>${formatAmount(project.znnFundsNeeded ?? 0)}</b>\n`;
    text += `  QSR needed: <b>${formatAmount(project.qsrFundsNeeded ?? 0)}</b>\n\n`;

    if (project.description) {
      const desc = project.description.length > 300
        ? project.description.slice(0, 300) + "..."
        : project.description;
      text += `<b>Description:</b>\n${escapeHtml(desc)}\n\n`;
    }

    text += `Phases: <b>${project.phases?.length ?? 0}</b>\n`;
    text += `Yes votes: <b>${project.yesVotes ?? 0}</b>\n`;
    text += `No votes: <b>${project.noVotes ?? 0}</b>\n`;
    text += `Total votes: <b>${project.totalVotes ?? 0}</b>`;

    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (err) {
    log.error({ err, projectId }, "Failed to get proposal");
    await ctx.reply("Failed to fetch proposal details.");
  }
});

// /zvote - Info about voting
composer.command("zvote", async (ctx) => {
  await ctx.reply(
    `<b>Accelerator-Z Voting:</b>\n\n` +
    `Only pillars can vote on Accelerator-Z proposals.\n` +
    `Voting is done through Syrius wallet or the CLI.\n\n` +
    `Use /zproposals to see current proposals.`,
    { parse_mode: "HTML" }
  );
});

export default composer;
