import crypto from "crypto";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) discord/1.0.9253 Chrome/148.0.7778.280 " +
  "Electron/42.7.1 Safari/537.36";

export class TelemetryService {
  constructor(token, user) {
    this.token = token.trim();
    this.user = user;
    this.analyticsToken = null;
    this.superProperties = this.buildSuperProperties();
    this.streamStartTime = null;
    this.heartbeatTimer = null;
    this.heartbeatSessionId = crypto.randomUUID();
    this.launchSignature = crypto.randomUUID();
    this.sequence = 0;
  }

  buildSuperProperties() {
    const props = {
      os: "Windows",
      browser: "Discord Client",
      release_channel: "stable",
      client_version: "1.0.9253",
      os_version: "10.0.26200",
      os_arch: "x64",
      app_arch: "x64",
      system_locale: "en-US",
      has_client_mods: false,
      browser_user_agent: USER_AGENT,
      browser_version: "42.7.1",
      os_sdk_version: "26200",
      client_build_number: 594031,
      native_build_number: 88414,
      client_event_source: null,
      client_app_state: "focused",
    };
    return Buffer.from(JSON.stringify(props)).toString("base64");
  }

  async init() {
    try {
      const res = await fetch("https://discord.com/api/v9/users/@me?with_analytics_token=true", {
        headers: {
          authorization: this.token,
          "user-agent": USER_AGENT,
          "x-super-properties": this.superProperties,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.analytics_token) {
          this.analyticsToken = data.analytics_token;
        }
      }
    } catch {
    }
  }

  nextSequence() {
    this.sequence += 1;
    return this.sequence;
  }

  async postScienceEvents(events) {
    try {
      if (!this.analyticsToken) {
        await this.init();
      }

      const payload = {
        token: this.analyticsToken,
        events: events.map((ev) => ({
          type: ev.type,
          properties: {
            client_track_timestamp: Date.now(),
            client_send_timestamp: Date.now(),
            client_heartbeat_session_id: this.heartbeatSessionId,
            launch_signature: this.launchSignature,
            event_sequence_number: this.nextSequence(),
            client_app_state: "focused",
            ...ev.properties,
          },
        })),
      };

      const res = await fetch("https://discord.com/api/v9/science", {
        method: "POST",
        headers: {
          authorization: this.token,
          "content-type": "application/json",
          origin: "https://discord.com",
          referer: "https://discord.com/channels/@me",
          "user-agent": USER_AGENT,
          "x-super-properties": this.superProperties,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      return res.status === 204;
    } catch {
      return false;
    }
  }

  async onStreamStarted(guildId, channelId) {
    this.streamStartTime = Date.now();
    this.heartbeatSessionId = crypto.randomUUID();

    await this.postScienceEvents([
      {
        type: "media_session_joined",
        properties: {
          guild_id: guildId,
          channel_id: channelId,
          channel_type: 2,
        },
      },
      {
        type: "video_stream_started",
        properties: {
          guild_id: guildId,
          channel_id: channelId,
          channel_type: 2,
        },
      },
    ]);

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(async () => {
      if (!this.streamStartTime) return;
      const totalDurationMs = Date.now() - this.streamStartTime;

      await this.postScienceEvents([
        {
          type: "video_stream_heartbeat",
          properties: {
            guild_id: guildId,
            channel_id: channelId,
            channel_type: 2,
            duration_tracked_ms: 60000,
            total_duration_ms: totalDurationMs,
          },
        },
      ]);
    }, 60000);
  }

  async onStreamEnded(guildId, channelId) {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    const durationMs = this.streamStartTime ? Date.now() - this.streamStartTime : 0;
    this.streamStartTime = null;

    await this.postScienceEvents([
      {
        type: "video_stream_ended",
        properties: {
          guild_id: guildId,
          channel_id: channelId,
          channel_type: 2,
          duration_ms: durationMs,
        },
      },
    ]);
  }
}
