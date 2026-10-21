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
      signal: AbortSignal.timeout(10000),
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
        chalk.white("No valid configuration found. Enter your credentials below.") +
        "\n" +
        chalk.gray("Tip: For multiple streamer accounts, paste tokens separated by commas."),
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
      name: "streamerTokens",
      message: chalk.green("STREAMER Token(s) (Main accounts, comma-separated if multiple):"),
      validate: (value) => (value && value.trim().length > 20 ? true : "Invalid Discord token."),
    },
    {
      type: "password",
      name: "viewerToken",
      message: chalk.magenta("VIEWER Token (Alt account):"),
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

  if (!response.streamerTokens || !response.viewerToken || !response.guildId || !response.channelId) {
    console.log(chalk.red("\nSetup aborted. Required fields were not provided."));
    process.exit(1);
  }

  const rawTokens = response.streamerTokens
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const uniqueStreamerTokens = [...new Set(rawTokens)];

  if (uniqueStreamerTokens.length === 0) {
    console.log(chalk.red("\nNo valid streamer tokens provided."));
    process.exit(1);
  }

  const spinner = ora("Verifying tokens...").start();

  const [streamerUsers, viewerUser] = await Promise.all([
    Promise.all(uniqueStreamerTokens.map((token) => verifyDiscordToken(token))),
    verifyDiscordToken(response.viewerToken),
  ]);

  const invalidIndices = streamerUsers
    .map((u, i) => (u ? null : i + 1))
    .filter((i) => i !== null);

  if (invalidIndices.length > 0) {
    spinner.fail(chalk.red(`Streamer token #${invalidIndices.join(", #")} is invalid.`));
    process.exit(1);
  }

  if (!viewerUser) {
    spinner.fail(chalk.red("Viewer token is invalid."));
    process.exit(1);
  }

  if (streamerUsers.some((u) => u.id === viewerUser.id)) {
    spinner.fail(chalk.red("Viewer account cannot be one of the Streamer accounts. Use a separate alt account."));
    process.exit(1);
  }

  spinner.succeed(
    chalk.green(
      `Verified accounts:\n` +
        streamerUsers.map((u, i) => `  - Streamer [${i + 1}]: ${chalk.bold(u.username)} (${u.id})`).join("\n") +
        `\n  - Viewer:        ${chalk.bold(viewerUser.username)} (${viewerUser.id})`
    )
  );

  const envContent = [
    `STREAMER_TOKENS=${uniqueStreamerTokens.join(",")}`,
    `VIEWER_TOKEN=${response.viewerToken.trim()}`,
    `GUILD_ID=${response.guildId.trim()}`,
    `CHANNEL_ID=${response.channelId.trim()}`,
    ``,
  ].join("\n");

  const envPath = path.resolve(process.cwd(), ".env");
  fs.writeFileSync(envPath, envContent, { encoding: "utf-8", mode: 0o600 });

  console.log(chalk.green(`\nSaved configuration to .env\n`));

  return {
    STREAMER_TOKENS: uniqueStreamerTokens.join(","),
    streamers: uniqueStreamerTokens.map((token, i) => ({
      token,
      user: streamerUsers[i],
    })),
    VIEWER_TOKEN: response.viewerToken.trim(),
    viewerUser,
    GUILD_ID: response.guildId.trim(),
    CHANNEL_ID: response.channelId.trim(),
    FPS: 1,
    BITRATE_KBPS: 50,
  };
}
