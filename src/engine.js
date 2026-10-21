import { Client } from "discord.js-selfbot-v13";
import { Streamer, prepareStream, playStream } from "@dank074/discord-video-stream";
import { ensureDummyMedia, injectFFmpegPath } from "./media.js";
import { loadStats, saveStats, detectProfileStreamingBadge } from "./storage.js";

const GatewayOpCodes = {
  VOICE_STATE_UPDATE: 4,
  STREAM_WATCH: 20,
};

export class StreamEngine {
  constructor(config, dashboard) {
    this.config = config;
    this.dashboard = dashboard;

    this.streamerClient = new Client({ checkUpdate: false });
    this.viewerClient = new Client({ checkUpdate: false });
    this.streamer = null;

    this.isRunning = false;
    this.isStreaming = false;
    this.isStartingBroadcast = false;

    this.streamCancelController = null;
    this.streamReconnectTimer = null;
    this.viewerReconnectTimer = null;
    this.viewerHeartbeatTimer = null;
    this.statsSaveTimer = null;
    this.profileCheckTimer = null;
    this.dummyVideoPath = null;

    this.stats = loadStats();
    this.sessionFarmedSeconds = 0;
    this.dashboard.setStats(this.stats.totalSeconds, this.sessionFarmedSeconds);
  }

  tick() {
    if (this.isStreaming) {
      this.stats.totalSeconds += 1;
      this.sessionFarmedSeconds += 1;
    }
    this.dashboard.setStats(this.stats.totalSeconds, this.sessionFarmedSeconds);
  }

  async start() {
    this.isRunning = true;
    injectFFmpegPath();

    this.dummyVideoPath = await ensureDummyMedia();
    await this.checkProfileBadge();

    this.streamer = new Streamer(this.streamerClient);

    this.streamerClient.on("ready", async () => {
      this.dashboard.addLog(`Streamer ready: ${this.streamerClient.user.tag}`, "success");
      await this.startBroadcastLoop(this.dummyVideoPath);
    });

    this.viewerClient.on("ready", async () => {
      this.dashboard.addLog(`Viewer ready: ${this.viewerClient.user.tag}`, "success");
      await this.startViewerWatcher();
    });

    this.streamerClient.on("voiceStateUpdate", (oldState, newState) => {
      if (!this.isRunning || newState.id !== this.streamerClient.user?.id) return;

      if (!newState.channelId) {
        this.dashboard.addLog("Streamer disconnected from voice! Rejoining in 5s...", "warn");
        this.dashboard.setStreamerStatus("Rejoining...");
        this.isStreaming = false;
        if (this.streamCancelController) {
          this.streamCancelController.abort();
        }
        this.scheduleStreamReconnect(5000);
      } else if (newState.channelId !== this.config.CHANNEL_ID) {
        this.dashboard.addLog("Streamer moved from target channel! Returning...", "warn");
        if (this.streamCancelController) {
          this.streamCancelController.abort();
        }
        this.scheduleStreamReconnect(3000);
      }
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
      if (this.isRunning && this.stats) {
        saveStats(this.stats);
      }
    }, 15000);

    this.profileCheckTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.checkProfileBadge();
      }
    }, 5 * 60 * 1000);

    await Promise.all([
      this.streamerClient.login(this.config.STREAMER_TOKEN),
      this.viewerClient.login(this.config.VIEWER_TOKEN),
    ]);
  }

  scheduleStreamReconnect(delayMs = 5000) {
    if (!this.isRunning) return;
    this.isStreaming = false;

    if (this.streamReconnectTimer) {
      clearTimeout(this.streamReconnectTimer);
      this.streamReconnectTimer = null;
    }

    this.streamReconnectTimer = setTimeout(() => {
      this.streamReconnectTimer = null;
      if (this.isRunning) {
        this.startBroadcastLoop(this.dummyVideoPath);
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

  async checkProfileBadge() {
    try {
      const streamerId = this.config.streamerUser?.id || this.streamerClient?.user?.id;
      if (!streamerId) return;

      const detected = await detectProfileStreamingBadge(streamerId, this.config.STREAMER_TOKEN);
      if (detected) {
        const minSecondsForTier = detected.hours * 3600;

        if (this.stats.totalSeconds < minSecondsForTier) {
          this.stats.totalSeconds = minSecondsForTier;
          this.stats.lastBadgeTier = detected.tier;
          saveStats(this.stats);
          this.dashboard.setStats(this.stats.totalSeconds, this.sessionFarmedSeconds);
          this.dashboard.addLog(`Profile sync: ${detected.name} badge detected (${detected.hours}h)`, "success");
        }
      }
    } catch {}
  }

  async startBroadcastLoop(videoPath) {
    if (!this.isRunning || this.isStartingBroadcast) return;
    this.isStartingBroadcast = true;

    const { GUILD_ID, CHANNEL_ID, FPS, BITRATE_KBPS } = this.config;

    try {
      if (this.streamReconnectTimer) {
        clearTimeout(this.streamReconnectTimer);
        this.streamReconnectTimer = null;
      }

      if (this.streamCancelController) {
        this.streamCancelController.abort();
      }
      try {
        this.streamer?.stopStream();
      } catch {}

      this.dashboard.setStreamerStatus("Joining channel...");
      await this.streamer.joinVoice(GUILD_ID, CHANNEL_ID);

      this.isStreaming = true;
      this.isStartingBroadcast = false;
      this.dashboard.setStreamerStatus("Broadcasting");

      const streamMedia = prepareStream(videoPath, {
        videoCodec: "H264",
        bitrateVideo: BITRATE_KBPS || 20,
        bitrateVideoMax: (BITRATE_KBPS || 20) + 15,
        frameRate: FPS || 1,
        width: 320,
        height: 240,
        includeAudio: false,
        customInputOptions: ["-stream_loop", "-1"],
      });

      this.streamCancelController = new AbortController();
      this.dashboard.addLog("Stream broadcast active", "success");
      this.triggerViewerWatch();

      await playStream(
        streamMedia.output,
        this.streamer,
        {
          type: "go-live",
          width: 320,
          height: 240,
          frameRate: FPS || 1,
        },
        this.streamCancelController.signal
      );
    } catch (err) {
      this.isStartingBroadcast = false;
      this.isStreaming = false;

      const wasAborted = this.streamCancelController?.signal?.aborted;
      if (!wasAborted && this.isRunning) {
        this.dashboard.addLog(`Stream error: ${err.message}`, "warn");
        this.dashboard.setStreamerStatus("Reconnecting...");
        this.scheduleStreamReconnect(10000);
      }
    }
  }

  async startViewerWatcher() {
    if (!this.isRunning) return;
    const { GUILD_ID, CHANNEL_ID } = this.config;

    try {
      if (this.viewerReconnectTimer) {
        clearTimeout(this.viewerReconnectTimer);
        this.viewerReconnectTimer = null;
      }

      this.viewerClient.ws.broadcast({
        op: GatewayOpCodes.VOICE_STATE_UPDATE,
        d: {
          guild_id: GUILD_ID,
          channel_id: CHANNEL_ID,
          self_mute: true,
          self_deaf: true,
          self_video: false,
        },
      });

      this.dashboard.setViewerStatus("In channel");
      this.dashboard.addLog("Viewer joined voice channel", "success");

      this.triggerViewerWatch();

      if (this.viewerHeartbeatTimer) clearInterval(this.viewerHeartbeatTimer);
      this.viewerHeartbeatTimer = setInterval(() => {
        if (this.isRunning && this.isStreaming) {
          this.viewerClient.ws.broadcast({
            op: GatewayOpCodes.VOICE_STATE_UPDATE,
            d: {
              guild_id: GUILD_ID,
              channel_id: CHANNEL_ID,
              self_mute: true,
              self_deaf: true,
              self_video: false,
            },
          });
          this.triggerViewerWatch();
        }
      }, 30000);
    } catch (err) {
      if (this.isRunning) {
        this.dashboard.addLog(`Viewer error: ${err.message}`, "warn");
        this.dashboard.setViewerStatus("Reconnecting...");
        this.scheduleViewerReconnect(10000);
      }
    }
  }

  triggerViewerWatch() {
    if (!this.streamerClient.user) return;

    const { GUILD_ID, CHANNEL_ID } = this.config;
    const streamerId = this.streamerClient.user.id;
    const streamKey = `guild:${GUILD_ID}:${CHANNEL_ID}:${streamerId}`;

    this.viewerClient.ws.broadcast({
      op: GatewayOpCodes.STREAM_WATCH,
      d: {
        stream_key: streamKey,
      },
    });

    this.dashboard.setViewerStatus("Watching (1 viewer)");
  }

  stop() {
    this.isRunning = false;
    this.isStreaming = false;
    this.isStartingBroadcast = false;

    if (this.streamReconnectTimer) {
      clearTimeout(this.streamReconnectTimer);
      this.streamReconnectTimer = null;
    }
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
    if (this.viewerHeartbeatTimer) {
      clearInterval(this.viewerHeartbeatTimer);
      this.viewerHeartbeatTimer = null;
    }

    if (this.stats) {
      saveStats(this.stats);
    }

    if (this.streamCancelController) {
      try {
        this.streamCancelController.abort();
      } catch {}
    }

    try {
      this.streamer?.stopStream();
      this.streamer?.leaveVoice();
    } catch {}

    try {
      this.streamerClient.destroy();
      this.viewerClient.destroy();
    } catch {}
  }
}
