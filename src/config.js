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

  let { STREAMER_TOKEN, VIEWER_TOKEN, GUILD_ID, CHANNEL_ID, RESOLUTION, FPS, BITRATE_KBPS } = process.env;

  const isConfigIncomplete =
    !hasEnvFile ||
    !STREAMER_TOKEN ||
    !VIEWER_TOKEN ||
    !GUILD_ID ||
    !CHANNEL_ID ||
    STREAMER_TOKEN.trim() === "" ||
    VIEWER_TOKEN.trim() === "" ||
    GUILD_ID.trim() === "" ||
    CHANNEL_ID.trim() === "";

  if (isConfigIncomplete) {
    return await runSetupWizard();
  }

  const spinner = ora("Validating accounts...").start();

  const [streamerUser, viewerUser] = await Promise.all([
    verifyDiscordToken(STREAMER_TOKEN),
    verifyDiscordToken(VIEWER_TOKEN),
  ]);

  if (!streamerUser) {
    spinner.fail(chalk.red("STREAMER_TOKEN in .env is invalid."));
    process.exit(1);
  }

  if (!viewerUser) {
    spinner.fail(chalk.red("VIEWER_TOKEN in .env is invalid."));
    process.exit(1);
  }

  spinner.succeed(
    chalk.green(
      `Accounts:\n  - Streamer: ${chalk.bold(streamerUser.username)} (${streamerUser.id})\n  - Viewer:   ${chalk.bold(viewerUser.username)} (${viewerUser.id})`
    )
  );

  return {
    STREAMER_TOKEN: STREAMER_TOKEN.trim(),
    VIEWER_TOKEN: VIEWER_TOKEN.trim(),
    GUILD_ID: GUILD_ID.trim(),
    CHANNEL_ID: CHANNEL_ID.trim(),
    RESOLUTION: RESOLUTION || "720p",
    FPS: parseInt(FPS || "1", 10),
    BITRATE_KBPS: parseInt(BITRATE_KBPS || "50", 10),
    streamerUser,
    viewerUser,
  };
}
