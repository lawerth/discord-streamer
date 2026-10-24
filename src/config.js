import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { runSetupWizard, verifyDiscordToken } from "./wizard.js";

dotenv.config();

export async function loadConfig() {
  const envPath = path.resolve(process.cwd(), ".env");
  const hasEnvFile = fs.existsSync(envPath);

  let { STREAMER_TOKENS, VIEWER_TOKEN, GUILD_ID, CHANNEL_ID, FPS, BITRATE_KBPS } = process.env;

  const streamerTokens = (STREAMER_TOKENS || "")
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const uniqueStreamerTokens = [...new Set(streamerTokens)];

  const isConfigIncomplete =
    !hasEnvFile ||
    uniqueStreamerTokens.length === 0 ||
    !VIEWER_TOKEN ||
    !GUILD_ID ||
    !CHANNEL_ID ||
    VIEWER_TOKEN.trim() === "" ||
    GUILD_ID.trim() === "" ||
    CHANNEL_ID.trim() === "";

  if (isConfigIncomplete) {
    return await runSetupWizard();
  }

  const spinner = ora("Validating accounts...").start();

  const [streamerUsers, viewerUser] = await Promise.all([
    Promise.all(uniqueStreamerTokens.map((t) => verifyDiscordToken(t))),
    verifyDiscordToken(VIEWER_TOKEN),
  ]);

  const invalidIndices = streamerUsers
    .map((u, i) => (u ? null : i + 1))
    .filter((i) => i !== null);

  if (invalidIndices.length > 0) {
    spinner.fail(chalk.red(`Streamer token #${invalidIndices.join(", #")} in .env is invalid.`));
    process.exit(1);
  }

  if (!viewerUser) {
    spinner.fail(chalk.red("VIEWER_TOKEN in .env is invalid."));
    process.exit(1);
  }

  if (streamerUsers.some((u) => u.id === viewerUser.id)) {
    spinner.fail(chalk.red("Viewer account cannot be one of the Streamer accounts. Use a separate alt account."));
    process.exit(1);
  }

  spinner.succeed(
    chalk.green(
      `Accounts:\n` +
        streamerUsers.map((u, i) => `  - Streamer [${i + 1}]: ${chalk.bold(u.username)} (${u.id})`).join("\n") +
        `\n  - Viewer:        ${chalk.bold(viewerUser.username)} (${viewerUser.id})`
    )
  );

  return {
    STREAMER_TOKENS: uniqueStreamerTokens.join(","),
    streamers: uniqueStreamerTokens.map((token, i) => ({
      token,
      user: streamerUsers[i],
    })),
    VIEWER_TOKEN: VIEWER_TOKEN.trim(),
    viewerUser,
    GUILD_ID: GUILD_ID.trim(),
    CHANNEL_ID: CHANNEL_ID.trim(),
    FPS: parseInt(FPS || "10", 10),
    BITRATE_KBPS: parseInt(BITRATE_KBPS || "150", 10),
  };
}
