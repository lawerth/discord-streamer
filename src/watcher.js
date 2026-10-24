import WebSocket from "ws";
import { Streamer } from "@dank074/discord-video-stream";

const VoiceOpCodes = {
  IDENTIFY: 0,
  SELECT_PROTOCOL: 1,
  READY: 2,
  HEARTBEAT: 3,
  SESSION_DESCRIPTION: 4,
  SPEAKING: 5,
  HEARTBEAT_ACK: 6,
  RESUME: 7,
  HELLO: 8,
  RESUMED: 9,
};

export class StreamWatchSession {
  constructor({ streamKey, endpoint, token, rtcServerId, userId, sessionId, onReady, onClose }) {
    this.streamKey = streamKey;
    this.endpoint = endpoint.replace(":443", "");
    this.token = token;
    this.rtcServerId = rtcServerId;
    this.userId = userId;
    this.sessionId = sessionId;
    this.onReady = onReady;
    this.onClose = onClose;

    this.ws = null;
    this.heartbeatTimer = null;
    this.isReady = false;
    this.isClosed = false;
  }

  start() {
    if (this.isClosed) return;
    try {
      this.ws = new WebSocket(`wss://${this.endpoint}/?v=8`);

      this.ws.on("open", () => {
        // Awaiting HELLO (op 8)
      });

      this.ws.on("message", (raw) => {
        try {
          const packet = JSON.parse(raw.toString("utf-8"));
          this.handlePacket(packet);
        } catch {}
      });

      this.ws.on("error", () => {
        // Handled via close
      });

      this.ws.on("close", () => {
        this.cleanup();
        if (this.onClose) this.onClose(this.streamKey);
      });
    } catch {
      this.cleanup();
      if (this.onClose) this.onClose(this.streamKey);
    }
  }

  handlePacket(packet) {
    const { op, d } = packet;

    if (op === VoiceOpCodes.HELLO) {
      const interval = d.heartbeat_interval || 30000;
      this.startHeartbeat(interval);

      this.send({
        op: VoiceOpCodes.IDENTIFY,
        d: {
          server_id: this.rtcServerId,
          user_id: this.userId,
          session_id: this.sessionId,
          token: this.token,
          video: true,
          streams: [
            {
              type: "video",
              rid: "100",
              quality: 100,
            },
          ],
        },
      });
    } else if (op === VoiceOpCodes.READY) {
      this.isReady = true;
      if (this.onReady) this.onReady(this.streamKey);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  startHeartbeat(interval) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.send({
        op: VoiceOpCodes.HEARTBEAT,
        d: Date.now(),
      });
    }, interval * 0.9);
  }

  cleanup() {
    this.isReady = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  stop() {
    this.isClosed = true;
    this.cleanup();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

export class WatcherManager {
  constructor(client, guildId, channelId, dashboard) {
    this.client = client;
    this.guildId = guildId;
    this.channelId = channelId;
    this.dashboard = dashboard;

    this.streamer = new Streamer(client);
    this.activeSessions = new Map(); // streamKey -> StreamWatchSession
    this.pendingData = new Map(); // streamKey -> { rtcServerId, endpoint, token }
    this.sessionId = null;
    this.isRunning = false;

    this.setupListeners();
  }

  setupListeners() {
    this.client.on("raw", (packet) => {
      if (!this.isRunning) return;

      if (packet.t === "VOICE_STATE_UPDATE") {
        if (packet.d?.user_id === this.client.user?.id) {
          if (packet.d.session_id) {
            this.sessionId = packet.d.session_id;
          }
        }
      } else if (packet.t === "STREAM_CREATE") {
        const { stream_key, rtc_server_id } = packet.d || {};
        if (!stream_key) return;
        const entry = this.pendingData.get(stream_key) || {};
        entry.rtcServerId = rtc_server_id;
        this.pendingData.set(stream_key, entry);
        this.checkAndConnectSession(stream_key);
      } else if (packet.t === "STREAM_SERVER_UPDATE") {
        const { stream_key, endpoint, token, rtc_server_id } = packet.d || {};
        if (!stream_key) return;
        const entry = this.pendingData.get(stream_key) || {};
        entry.endpoint = endpoint;
        entry.token = token;
        if (rtc_server_id) {
          entry.rtcServerId = rtc_server_id;
        }
        this.pendingData.set(stream_key, entry);
        this.checkAndConnectSession(stream_key);
      } else if (packet.t === "STREAM_DELETE") {
        const { stream_key } = packet.d || {};
        if (stream_key) {
          this.stopSession(stream_key);
        }
      }
    });
  }

  async start() {
    this.isRunning = true;
    try {
      this.dashboard?.setViewerStatus("Joining channel (WebRTC)...");
      try {
        this.streamer.leaveVoice();
      } catch {}
      await this.streamer.joinVoice(this.guildId, this.channelId);
      this.sessionId = this.streamer.voiceConnection?.session_id || this.sessionId;
      this.dashboard?.setViewerStatus("In channel");
      this.dashboard?.addLog("Viewer joined voice channel (WebRTC active)", "success");
    } catch (err) {
      this.dashboard?.setViewerStatus("Voice error");
      this.dashboard?.addLog(`Viewer voice connection failed: ${err.message}`, "error");
      throw err;
    }
  }

  checkAndConnectSession(streamKey) {
    if (!this.isRunning) return;
    const data = this.pendingData.get(streamKey);
    if (!data || !data.endpoint || !data.token) return;
    if (this.activeSessions.has(streamKey)) return;

    const rtcServerId = data.rtcServerId
      || this.streamer.voiceConnection?.streamConnection?.serverId
      || this.guildId;
    if (!rtcServerId) return;

    const sessionId = this.sessionId || this.streamer.voiceConnection?.session_id;
    if (!sessionId || !this.client.user) return;

    const session = new StreamWatchSession({
      streamKey,
      endpoint: data.endpoint,
      token: data.token,
      rtcServerId,
      userId: this.client.user.id,
      sessionId,
      onReady: (key) => {
        const username = key.split(":").pop();
        this.dashboard?.addLog(`Viewer watching stream: ${username} (RTC connected)`, "success");
        this.updateDashboardStatus();
      },
      onClose: (key) => {
        this.activeSessions.delete(key);
        this.updateDashboardStatus();

        if (this.isRunning && this.pendingData.has(key)) {
          setTimeout(() => {
            if (this.isRunning && this.pendingData.has(key) && !this.activeSessions.has(key)) {
              this.watchStream(key);
            }
          }, 5000);
        }
      },
    });

    this.activeSessions.set(streamKey, session);
    session.start();
    this.updateDashboardStatus();
  }

  watchStream(streamKey) {
    if (!this.isRunning) return;

    if (!this.streamer.voiceConnection || !this.streamer.voiceConnection.status?.started) {
      this.dashboard?.addLog("Viewer not in voice yet, deferring stream watch...", "warn");
      return;
    }

    if (this.activeSessions.has(streamKey) && this.activeSessions.get(streamKey).isReady) {
      return;
    }
    this.client.ws.broadcast({
      op: 20,
      d: {
        stream_key: streamKey,
      },
    });
  }

  stopSession(streamKey) {
    const session = this.activeSessions.get(streamKey);
    if (session) {
      session.stop();
      this.activeSessions.delete(streamKey);
    }
    this.pendingData.delete(streamKey);
    this.updateDashboardStatus();
  }

  updateDashboardStatus() {
    const count = Array.from(this.activeSessions.values()).filter((s) => s.isReady).length;
    if (count > 0) {
      this.dashboard?.setViewerStatus(`Watching (${count} stream${count > 1 ? "s" : ""})`);
    } else if (this.activeSessions.size > 0) {
      this.dashboard?.setViewerStatus(`Connecting to stream (${this.activeSessions.size})...`);
    } else {
      this.dashboard?.setViewerStatus("In channel (Waiting for streams)");
    }
  }

  getWatchingCount() {
    return Array.from(this.activeSessions.values()).filter((s) => s.isReady).length;
  }

  stop() {
    this.isRunning = false;
    for (const [, session] of this.activeSessions.entries()) {
      session.stop();
    }
    this.activeSessions.clear();
    this.pendingData.clear();
    try {
      this.streamer?.leaveVoice();
    } catch {}
  }
}
