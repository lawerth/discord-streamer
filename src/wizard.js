import prompts from "prompts";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import gradient from "gradient-string";
import boxen from "boxen";
import ora from "ora";
import { ASCII_BANNER } from "./constants.js";

export async function verifyDiscordToken(token) {
  try {
    const res = await fetch("https://discord.com/api/v9/users/@me", {
      headers: {
        Authorization: token.trim(),
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function runSetupWizard() {
  console.clear();
  console.log(gradient.pastel.multiline(ASCII_BANNER));

  console.log(
    boxen(
      chalk.bold.cyan(" Setup Wizard ") +
        "\n\n" +
        chalk.white("No configuration found. Please enter your credentials below."),
      {
        padding: 1,
        margin: 1,
        borderColor: "cyan",
        borderStyle: "round",
      }
    )
  );

  const questions = [
    {
      type: "password",
      name: "streamerToken",
      message: chalk.green("STREAMER Token (Main):"),
      validate: (value) => (value && value.trim().length > 20 ? true : "Invalid Discord token."),
    },
    {
      type: "password",
      name: "viewerToken",
      message: chalk.magenta("VIEWER Token (Alt):"),
      validate: (value) => (value && value.trim().length > 20 ? true : "Invalid Discord token."),
    },
    {
      type: "text",
      name: "guildId",
      message: chalk.yellow("Server (Guild) ID:"),
      validate: (value) => (/^\d{17,20}$/.test(value.trim()) ? true : "Invalid numeric Guild ID."),
    },
    {
      type: "text",
      name: "channelId",
      message: chalk.blue("Voice Channel ID:"),
      validate: (value) => (/^\d{17,20}$/.test(value.trim()) ? true : "Invalid numeric Channel ID."),
    },
  ];

  const response = await prompts(questions);

  if (!response.streamerToken || !response.viewerToken || !response.guildId || !response.channelId) {
    console.log(chalk.red("\nSetup aborted. Required fields were not provided."));
    process.exit(1);
  }

  const spinner = ora("Verifying tokens...").start();

  const [streamerUser, viewerUser] = await Promise.all([
    verifyDiscordToken(response.streamerToken),
    verifyDiscordToken(response.viewerToken),
  ]);

  if (!streamerUser) {
    spinner.fail(chalk.red("Invalid Streamer token."));
    process.exit(1);
  }

  if (!viewerUser) {
    spinner.fail(chalk.red("Invalid Viewer token."));
    process.exit(1);
  }

  spinner.succeed(
    chalk.green(
      `Verified accounts:\n  - Streamer: ${chalk.bold(streamerUser.username)} (${streamerUser.id})\n  - Viewer:   ${chalk.bold(viewerUser.username)} (${viewerUser.id})`
    )
  );

  const envContent = [
    `STREAMER_TOKEN=${response.streamerToken.trim()}`,
    `VIEWER_TOKEN=${response.viewerToken.trim()}`,
    `GUILD_ID=${response.guildId.trim()}`,
    `CHANNEL_ID=${response.channelId.trim()}`,
    `RESOLUTION=720p`,
    `FPS=1`,
    `BITRATE_KBPS=50`,
    ``,
  ].join("\n");

  const envPath = path.resolve(process.cwd(), ".env");
  fs.writeFileSync(envPath, envContent, "utf-8");

  console.log(chalk.green(`\nSaved configuration to .env\n`));

  return {
    STREAMER_TOKEN: response.streamerToken.trim(),
    VIEWER_TOKEN: response.viewerToken.trim(),
    GUILD_ID: response.guildId.trim(),
    CHANNEL_ID: response.channelId.trim(),
    RESOLUTION: "720p",
    FPS: 1,
    BITRATE_KBPS: 50,
    streamerUser,
    viewerUser,
  };
}
