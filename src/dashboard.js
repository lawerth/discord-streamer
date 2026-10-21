import chalk from "chalk";
import boxen from "boxen";
import logUpdate from "log-update";
import gradient from "gradient-string";
import { getBadgeProgress } from "./constants.js";

function createProgressBar(percent, length = 30) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  const bar = chalk.cyan("█".repeat(filled)) + chalk.gray("░".repeat(empty));
  return `[${bar}] ${chalk.bold.yellow(clamped.toFixed(1) + "%")}`;
}

function formatDuration(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours.toString().padStart(2, "0")}h`);
  parts.push(`${minutes.toString().padStart(2, "0")}m`);
  parts.push(`${seconds.toString().padStart(2, "0")}s`);

  return parts.join(" ");
}

export class Dashboard {
  constructor(config, initialTotalSeconds = 0) {
    this.config = config;
    this.startTime = Date.now();
    this.initialTotalSeconds = initialTotalSeconds;
    this.totalSeconds = initialTotalSeconds;
    this.streamerStatus = "Connecting...";
    this.viewerStatus = "Connecting...";
    this.streamQuality = `${config.FPS || 1} FPS / ${config.BITRATE_KBPS || 50} kbps`;
    this.logs = [];
    this.maxLogs = 4;
  }

  setTotalSeconds(seconds) {
    this.totalSeconds = Math.max(this.totalSeconds, seconds);
    this.render();
  }

  addLog(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = chalk.blue("[INFO]");
    if (type === "success") prefix = chalk.green("[SUCCESS]");
    if (type === "warn") prefix = chalk.yellow("[WARN]");
    if (type === "error") prefix = chalk.red("[ERROR]");

    this.logs.unshift(`${chalk.gray(timestamp)} ${prefix} ${message}`);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    this.render();
  }

  setStreamerStatus(status) {
    this.streamerStatus = status;
    this.render();
  }

  setViewerStatus(status) {
    this.viewerStatus = status;
    this.render();
  }

  render(isStreaming = false) {
    const sessionSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const activeTotalSeconds = this.totalSeconds + (isStreaming ? sessionSeconds : 0);
    const totalHours = activeTotalSeconds / 3600;
    const progress = getBadgeProgress(totalHours);

    const currentTierName = progress.currentTier
      ? `${progress.currentTier.icon} ${progress.currentTier.name} - ${progress.currentTier.hours}h`
      : chalk.gray("Unranked (< 1 Hour)");

    const nextTierName = progress.nextTier
      ? `${progress.nextTier.icon} ${progress.nextTier.name} - ${progress.nextTier.hours}h`
      : chalk.green("Max Level (5,000h) Achieved!");

    const progressBar = createProgressBar(progress.progressPercent, 28);

    const content = [
      chalk.bold(gradient.morning("  === DISCORD STREAMER ===  ")),
      "",
      chalk.bold(" Accounts:"),
      `  Streamer : ${chalk.bold.green(this.config.streamerUser?.username || "Streamer")} -> ${this.streamerStatus}`,
      `  Viewer   : ${chalk.bold.magenta(this.config.viewerUser?.username || "Viewer")} -> ${this.viewerStatus}`,
      `  Channel  : Guild ${chalk.yellow(this.config.GUILD_ID)} / ${chalk.yellow(this.config.CHANNEL_ID)}`,
      "",
      chalk.bold(" Stats:"),
      `  Session Time : ${chalk.bold.white(formatDuration(sessionSeconds))}`,
      `  Total Farmed : ${chalk.bold.cyan(formatDuration(activeTotalSeconds))} (${totalHours.toFixed(3)} hrs)`,
      `  Spec         : ${chalk.gray(this.streamQuality)}`,
      "",
      chalk.bold(" Badge Progression:"),
      `  Current Tier : ${currentTierName}`,
      `  Next Tier    : ${nextTierName}`,
      `  Progress     : ${progressBar}`,
      progress.nextTier ? `  Remaining    : ${chalk.yellow(progress.neededHours.toFixed(2))} hours` : "",
      "",
      chalk.bold(" Logs:"),
      ...(this.logs.length > 0 ? this.logs.map((l) => `  ${l}`) : [chalk.gray("  No events yet.")]),
    ]
      .filter((line) => line !== null)
      .join("\n");

    const boxed = boxen(content, {
      padding: 1,
      margin: 0,
      borderColor: "blueBright",
      borderStyle: "round",
    });

    logUpdate(boxed);
  }
}
