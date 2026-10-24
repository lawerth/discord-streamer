import { Client } from "@lng2004/discord.js-selfbot-v13";
import { Streamer, prepareStream, playStream } from "@dank074/discord-video-stream";
import { ensureDummyMedia, injectFFmpegPath } from "./media.js";
import { loadStats, saveStats, detectProfileStreamingBadge } from "./storage.js";
import { TelemetryService } from "./telemetry.js";
import { WatcherManager } from "./watcher.js";

export class StreamEngine {
  constructor(config, dashboard) {
    this.config = config;
    this.dashboard = dashboard;

    this.viewerClient = new Client({ checkUpdate: false });
    this.viewerManager = new WatcherManager(
      this.viewerClient,
      config.GUILD_ID,
      config.CHANNEL_ID,
      dashboard
    );
    this.statsData = loadStats();

    this.streamers = config.streamers.map((s) => {
      const streamerStats = this.statsData.streamers[s.user.id] || {
        totalSeconds: 0,
        lastBadgeTier: 0,
      };
      this.statsData.streamers[s.user.id] = streamerStats;

      const client = new Client({ checkUpdate: false });
      return {
        id: s.user.id,
        user: s.user,
        token: s.token,
        client: client,
        streamer: new Streamer(client),
        telemetry: new TelemetryService(s.token, s.user),
        isStreaming: false,
        isStartingBroadcast: false,
        streamCancelController: null,
        reconnectTimer: null,
        status: "Connecting...",
        sessionFarmedSeconds: 0,
        stats: streamerStats,
      };
    });

    this.isRunning = false;
    this.viewerReconnectTimer = null;
    this.statsSaveTimer = null;
    this.profileCheckTimer = null;
    this.streamWatchdogTimer = null;
    this.dummyVideoPath = null;

    this.syncDashboardStreamers();
  }

  syncDashboardStreamers() {
    this.dashboard.updateStreamers(
      this.streamers.map((s) => ({
        id: s.id,
        username: s.user.username,
        tag: s.user.tag || s.user.username,
        status: s.status,
        isStreaming: s.isStreaming,
        totalSeconds: s.stats.totalSeconds,
        sessionSeconds: s.sessionFarmedSeconds,
      }))
    );
  }

  tick() {
    for (const streamer of this.streamers) {
      if (streamer.isStreaming) {
        streamer.stats.totalSeconds += 1;
        streamer.sessionFarmedSeconds += 1;
      }
    }
    this.syncDashboardStreamers();
  }

  async start() {
    this.isRunning = true;
    injectFFmpegPath();

    this.dummyVideoPath = await ensureDummyMedia();
    await this.checkAllProfileBadges();

    await Promise.all(this.streamers.map((s) => s.telemetry.init()));

    for (const streamer of this.streamers) {
      streamer.client.on("ready", async () => {
        this.dashboard.addLog(`Streamer ready: ${streamer.user.username}`, "success");
        await this.startStreamerBroadcast(streamer);
      });

      streamer.client.on("voiceStateUpdate", (oldState, newState) => {
        if (!this.isRunning || newState.id !== streamer.user.id) return;

        if (!newState.channelId) {
          this.dashboard.addLog(`Streamer ${streamer.user.username} disconnected! Rejoining in 5s...`, "warn");
          streamer.status = "Rejoining...";
          streamer.isStreaming = false;
          if (streamer.streamCancelController) {
            streamer.streamCancelController.abort();
          }
          this.scheduleStreamerReconnect(streamer, 5000);
          this.triggerViewerWatch();
          this.syncDashboardStreamers();
        } else if (newState.channelId !== this.config.CHANNEL_ID) {
          this.dashboard.addLog(`Streamer ${streamer.user.username} moved! Returning...`, "warn");
          if (streamer.streamCancelController) {
            streamer.streamCancelController.abort();
          }
          this.scheduleStreamerReconnect(streamer, 3000);
          this.syncDashboardStreamers();
        }
      });
    }

    this.viewerClient.on("ready", async () => {
      this.dashboard.addLog(`Viewer ready: ${this.viewerClient.user.tag}`, "success");
      await this.startViewerWatcher();
    });

    this.viewerClient.on("voiceStateUpdate", (oldState, newState) => {
      if (!this.isRunning || newState.id !== this.viewerClient.user?.id) return;

      if (!newState.channelId) {
        this.dashboard.addLog("Viewer disconnected from voice! Rejoining in 5s...", "warn");
        this.dashboard.setViewerStatus("Rejoining...");
        this.scheduleViewerReconnect(5000);
      } else if (newState.channelId !== this.config.CHANNEL_ID) {
        this.dashboard.addLog("Viewer moved from target channel! Returning...", "warn");
        this.scheduleViewerReconnect(3000);
      }
    });

    this.statsSaveTimer = setInterval(() => {
      if (this.isRunning && this.statsData) {
        saveStats(this.statsData);
      }
    }, 15000);

    this.profileCheckTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.checkAllProfileBadges();
      }
    }, 5 * 60 * 1000);

    this.streamWatchdogTimer = setInterval(() => {
      if (!this.isRunning) return;

      for (const streamer of this.streamers) {
        if (streamer.isStreaming && !streamer.isStartingBroadcast && !streamer.reconnectTimer) {
          const streamConn = streamer.streamer?.voiceConnection?.streamConnection;
          const isStreamDead = !streamConn || (streamConn.ws && streamConn.ws.readyState > 1);
          const isVoiceDead = !streamer.streamer?.voiceConnection || streamer.streamer?.voiceConnection?.status?.started === false;

          if (isStreamDead || isVoiceDead) {
            this.dashboard.addLog(`Stream watchdog: ${streamer.user.username} stream stalled! Recovering...`, "warn");
            streamer.isStreaming = false;
            if (streamer.streamCancelController) {
              streamer.streamCancelController.abort();
            }
            this.scheduleStreamerReconnect(streamer, 2000);
          }
        }
      }
    }, 10000);

    const logins = [
      ...this.streamers.map((s) => s.client.login(s.token)),
      this.viewerClient.login(this.config.VIEWER_TOKEN),
    ];
    await Promise.all(logins);
  }

  scheduleStreamerReconnect(streamer, delayMs = 5000) {
    if (!this.isRunning) return;
    streamer.isStreaming = false;

    if (streamer.reconnectTimer) {
      clearTimeout(streamer.reconnectTimer);
      streamer.reconnectTimer = null;
    }

    streamer.reconnectTimer = setTimeout(() => {
      streamer.reconnectTimer = null;
      if (this.isRunning) {
        this.startStreamerBroadcast(streamer);
      }
    }, delayMs);
  }

  scheduleViewerReconnect(delayMs = 5000) {
    if (!this.isRunning) return;

    if (this.viewerReconnectTimer) {
      clearTimeout(this.viewerReconnectTimer);
      this.viewerReconnectTimer = null;
    }

    this.viewerReconnectTimer = setTimeout(() => {
      this.viewerReconnectTimer = null;
      if (this.isRunning) {
        this.startViewerWatcher();
      }
    }, delayMs);
  }

  async checkAllProfileBadges() {
    try {
      for (const streamer of this.streamers) {
        const detected = await detectProfileStreamingBadge(streamer.id, streamer.token);
        if (detected) {
          const minSeconds = detected.hours * 3600;
          if (streamer.stats.totalSeconds < minSeconds) {
            streamer.stats.totalSeconds = minSeconds;
            streamer.stats.lastBadgeTier = detected.tier;
            saveStats(this.statsData);
            this.dashboard.addLog(`Profile sync: ${streamer.user.username} -> ${detected.name} (${detected.hours}h)`, "success");
          }
        }
      }
      this.syncDashboardStreamers();
    } catch {}
  }

  async startStreamerBroadcast(streamer) {
    if (!this.isRunning || streamer.isStartingBroadcast) return;
    streamer.isStartingBroadcast = true;

    const { GUILD_ID, CHANNEL_ID, FPS, BITRATE_KBPS } = this.config;

    try {
      if (streamer.reconnectTimer) {
        clearTimeout(streamer.reconnectTimer);
        streamer.reconnectTimer = null;
      }

      if (streamer.streamCancelController) {
        streamer.streamCancelController.abort();
      }
      try {
        streamer.streamer?.stopStream();
        streamer.streamer?.leaveVoice();
      } catch {}

      streamer.status = "Joining channel...";
      this.syncDashboardStreamers();

      await streamer.streamer.joinVoice(GUILD_ID, CHANNEL_ID);

      const effectiveFps = Math.max(FPS || 10, 5);
      const effectiveBitrate = Math.max(BITRATE_KBPS || 150, 100);

      const streamMedia = prepareStream(this.dummyVideoPath, {
        videoCodec: "H264",
        bitrateVideo: effectiveBitrate,
        bitrateVideoMax: effectiveBitrate + 50,
        frameRate: effectiveFps,
        width: 480,
        height: 270,
        includeAudio: true,
        customInputOptions: ["-stream_loop", "-1"],
      });

      streamer.streamCancelController = new AbortController();
      streamer.isStreaming = true;
      streamer.isStartingBroadcast = false;
      streamer.status = "Broadcasting";
      this.syncDashboardStreamers();

      await streamer.telemetry.onStreamStarted(GUILD_ID, CHANNEL_ID);
      this.dashboard.addLog(`Stream active: ${streamer.user.username}`, "success");
      this.triggerViewerWatch();

      await playStream(
        streamMedia.output,
        streamer.streamer,
        {
          type: "go-live",
          width: 480,
          height: 270,
          frameRate: effectiveFps,
        },
        streamer.streamCancelController.signal
      );

      streamer.isStreaming = false;
      const wasAborted = streamer.streamCancelController?.signal?.aborted;
      if (!wasAborted && this.isRunning) {
        this.dashboard.addLog(`Stream cycle completed (${streamer.user.username}). Restarting...`, "info");
        try {
          await streamer.telemetry.onStreamEnded(GUILD_ID, CHANNEL_ID);
        } catch {}
        const streamKey = `guild:${GUILD_ID}:${CHANNEL_ID}:${streamer.user.id}`;
        this.viewerManager.stopSession(streamKey);

        this.scheduleStreamerReconnect(streamer, 2000);
      }
    } catch (err) {
      streamer.isStartingBroadcast = false;
      streamer.isStreaming = false;

      try {
        await streamer.telemetry.onStreamEnded(GUILD_ID, CHANNEL_ID);
      } catch {}

      const streamKey = `guild:${GUILD_ID}:${CHANNEL_ID}:${streamer.user.id}`;
      this.viewerManager.stopSession(streamKey);

      const wasAborted = streamer.streamCancelController?.signal?.aborted;
      if (!wasAborted && this.isRunning) {
        this.dashboard.addLog(`Stream error (${streamer.user.username}): ${err.message}`, "warn");
        streamer.status = "Reconnecting...";
        this.syncDashboardStreamers();
        this.scheduleStreamerReconnect(streamer, 10000);
      }
      this.triggerViewerWatch();
    }
  }

  async startViewerWatcher() {
    if (!this.isRunning) return;

    try {
      if (this.viewerReconnectTimer) {
        clearTimeout(this.viewerReconnectTimer);
        this.viewerReconnectTimer = null;
      }

      await this.viewerManager.start();
      this.triggerViewerWatch();
    } catch (err) {
      if (this.isRunning) {
        this.dashboard.addLog(`Viewer voice error: ${err.message}`, "warn");
        this.dashboard.setViewerStatus("Reconnecting...");
        this.scheduleViewerReconnect(10000);
      }
    }
  }

  triggerViewerWatch() {
    const activeStreamers = this.streamers.filter((s) => s.isStreaming && s.client.user);
    if (activeStreamers.length === 0) {
      this.viewerManager.updateDashboardStatus();
      return;
    }

    const { GUILD_ID, CHANNEL_ID } = this.config;

    for (const streamer of activeStreamers) {
      const streamKey = `guild:${GUILD_ID}:${CHANNEL_ID}:${streamer.user.id}`;
      this.viewerManager.watchStream(streamKey);
    }
  }

  stop() {
    this.isRunning = false;

    if (this.viewerReconnectTimer) {
      clearTimeout(this.viewerReconnectTimer);
      this.viewerReconnectTimer = null;
    }
    if (this.statsSaveTimer) {
      clearInterval(this.statsSaveTimer);
      this.statsSaveTimer = null;
    }
    if (this.profileCheckTimer) {
      clearInterval(this.profileCheckTimer);
      this.profileCheckTimer = null;
    }
    if (this.streamWatchdogTimer) {
      clearInterval(this.streamWatchdogTimer);
      this.streamWatchdogTimer = null;
    }

    if (this.statsData) {
      saveStats(this.statsData);
    }

    this.viewerManager.stop();

    for (const streamer of this.streamers) {
      streamer.isStreaming = false;
      streamer.isStartingBroadcast = false;

      try {
        streamer.telemetry.onStreamEnded(this.config.GUILD_ID, this.config.CHANNEL_ID);
      } catch {}

      if (streamer.reconnectTimer) {
        clearTimeout(streamer.reconnectTimer);
        streamer.reconnectTimer = null;
      }
      if (streamer.streamCancelController) {
        try {
          streamer.streamCancelController.abort();
        } catch {}
      }
      try {
        streamer.streamer?.stopStream();
        streamer.streamer?.leaveVoice();
      } catch {}
      try {
        streamer.client.destroy();
      } catch {}
    }

    try {
      this.viewerClient.destroy();
    } catch {}
  }
}
