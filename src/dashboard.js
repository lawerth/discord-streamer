import chalk from "chalk";
import boxen from "boxen";
import logUpdate from "log-update";
import gradient from "gradient-string";
import { getBadgeProgress } from "./constants.js";

function createProgressBar(percent, length = 26) {
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
  constructor(config) {
    this.config = config;
    this.viewerStatus = "Connecting...";
    this.streamQuality = `${config.FPS || 1} FPS / ${config.BITRATE_KBPS || 50} kbps`;
    this.logs = [];
    this.maxLogs = 4;

    this.streamers = (config.streamers || []).map((s) => ({
      id: s.user.id,
      username: s.user.username,
      status: "Connecting...",
      isStreaming: false,
      totalSeconds: 0,
      sessionSeconds: 0,
    }));
  }

  updateStreamers(streamersData) {
    this.streamers = streamersData;
    this.render();
  }

  setViewerStatus(status) {
    this.viewerStatus = status;
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

  render() {
    const isMultiStreamer = this.streamers.length > 1;

    let streamerContent = [];

    if (!isMultiStreamer && this.streamers.length === 1) {
      const s = this.streamers[0];
      const totalHours = s.totalSeconds / 3600;
      const progress = getBadgeProgress(totalHours);

      const currentTierName = progress.currentTier
        ? `${progress.currentTier.icon} ${progress.currentTier.name} - ${progress.currentTier.hours}h`
        : chalk.gray("Unranked (< 1 Hour)");

      const nextTierName = progress.nextTier
        ? `${progress.nextTier.icon} ${progress.nextTier.name} - ${progress.nextTier.hours}h`
        : chalk.green("Max Level (5,000h) Achieved!");

      const progressBar = createProgressBar(progress.progressPercent, 28);

      let statusColor = chalk.yellow;
      if (s.status === "Broadcasting") statusColor = chalk.green;
      if (s.status.includes("Error") || s.status.includes("Rejoining")) statusColor = chalk.red;

      streamerContent = [
        chalk.bold(" Accounts:"),
        `  Streamer : ${chalk.bold.green(s.username)} -> ${statusColor(s.status)}`,
        `  Viewer   : ${chalk.bold.magenta(this.config.viewerUser?.username || "Viewer")} -> ${this.viewerStatus}`,
        `  Channel  : Guild ${chalk.yellow(this.config.GUILD_ID)} / ${chalk.yellow(this.config.CHANNEL_ID)}`,
        "",
        chalk.bold(" Stats:"),
        `  Session Time : ${chalk.bold.white(formatDuration(s.sessionSeconds))}`,
        `  Total Farmed : ${chalk.bold.cyan(formatDuration(s.totalSeconds))} (${totalHours.toFixed(3)} hrs)`,
        `  Spec         : ${chalk.gray(this.streamQuality)}`,
        "",
        chalk.bold(" Badge Progression:"),
        `  Current Tier : ${currentTierName}`,
        `  Next Tier    : ${nextTierName}`,
        `  Progress     : ${progressBar}`,
        progress.nextTier ? `  Remaining    : ${chalk.yellow(progress.neededHours.toFixed(2))} hours` : "",
      ];
    } else {
      const activeCount = this.streamers.filter((s) => s.isStreaming).length;

      streamerContent = [
        chalk.bold(" Channel & Viewer:"),
        `  Viewer   : ${chalk.bold.magenta(this.config.viewerUser?.username || "Viewer")} -> ${this.viewerStatus}`,
        `  Channel  : Guild ${chalk.yellow(this.config.GUILD_ID)} / ${chalk.yellow(this.config.CHANNEL_ID)}`,
        `  Spec     : ${chalk.gray(this.streamQuality)}`,
        "",
        chalk.bold(` Streamers (${this.streamers.length} accounts, ${activeCount} active):`),
      ];

      for (let i = 0; i < this.streamers.length; i++) {
        const s = this.streamers[i];
        const totalHours = s.totalSeconds / 3600;
        const progress = getBadgeProgress(totalHours);

        const currentTier = progress.currentTier
          ? `${progress.currentTier.icon} ${progress.currentTier.name} (${progress.currentTier.hours}h)`
          : chalk.gray("Unranked (< 1h)");

        const nextTier = progress.nextTier
          ? `${progress.nextTier.icon} ${progress.nextTier.name} (${progress.nextTier.hours}h)`
          : chalk.green("Max (5,000h)");

        const progressBar = createProgressBar(progress.progressPercent, 20);

        let statusColor = chalk.yellow;
        if (s.status === "Broadcasting") statusColor = chalk.green;
        if (s.status.includes("Error") || s.status.includes("Rejoining")) statusColor = chalk.red;

        streamerContent.push(
          `  ${chalk.bold.white(`[${i + 1}]`)} ${chalk.bold.green(s.username)} -> ${statusColor(s.status)}`,
          `      Farmed: ${chalk.bold.cyan(formatDuration(s.totalSeconds))} (${totalHours.toFixed(2)}h)  |  Session: ${chalk.white(formatDuration(s.sessionSeconds))}`,
          `      Badge:  ${currentTier} -> ${nextTier}`,
          `      Prog:   ${progressBar}` + (progress.nextTier ? chalk.gray(` (${progress.neededHours.toFixed(1)}h left)`) : ""),
          ""
        );
      }
    }

    const logLines = [];
    for (let i = 0; i < this.maxLogs; i++) {
      if (this.logs[i]) {
        logLines.push(`  ${this.logs[i]}`);
      } else if (i === 0 && this.logs.length === 0) {
        logLines.push(chalk.gray("  No events yet."));
      } else {
        logLines.push(chalk.gray("  -"));
      }
    }

    const content = [
      chalk.bold(gradient.morning("  === DISCORD STREAMER ===  ")),
      "",
      ...streamerContent,
      chalk.bold(" Logs:"),
      ...logLines,
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
