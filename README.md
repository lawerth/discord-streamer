# Discord Stream Farm

Lightweight automated streaming utility to level up Discord's progressive Streaming profile badge.

Streams a low-bitrate, 1 FPS dummy video loop from your main account while an alt account watches the stream via Gateway `STREAM_WATCH` (Opcode 20) packets to register active audience hours.

---

### Badge Milestones

| Tier | Badge Name | Required Stream Time |
| :---: | :--- | :---: |
| 1 | 🖥️ **Newcomer** | **1 Hour** |
| 2 | 🟢 **Fledgling** | **5 Hours** |
| 3 | 🍏 **Breakout** | **20 Hours** |
| 4 | 🐬 **Standout** | **75 Hours** |
| 5 | 🌊 **Trendsetter** | **150 Hours** |
| 6 | 🔷 **Headliner** | **300 Hours** |
| 7 | 🟣 **Superstar** | **500 Hours** |
| 8 | 🌸 **Sensation** | **1,000 Hours** |
| 9 | 🌺 **Visionary** | **2,000 Hours** |
| 10 | 👑 **Phenomenon** | **5,000+ Hours** |

> **Requirement:** Discord requires at least one active viewer in the channel for hours to accumulate. This project uses an alt account that automatically connects and watches the stream.

---

### Features

- **Low Resource Usage:** Loops a 4 KB, 1 FPS black video frame (~0.1% CPU, minimal bandwidth).
- **Auto Sync & Persistence:** Saves accumulated stream time to disk (`data/stats.json`) and automatically syncs progress if a higher badge tier is detected on your profile.
- **Interactive Setup:** Prompts for tokens and channel IDs on first run and verifies them via Discord's API.
- **Terminal UI:** Displays current tier, progress bar, active session time, and event logs.
- **Auto Reconnect:** Reconnects automatically if Discord drops voice or stream connections.
- **Docker Support:** Runs with a single `docker compose up -d` command.

---

### Setup

#### Requirements
- Node.js 18+
- Two Discord accounts:
  - **Streamer Account:** Your main account.
  - **Viewer Account:** An alt account to watch the broadcast.

#### Installation

```bash
git clone https://github.com/your-username/discord-stream-farm.git
cd discord-stream-farm
npm install
npm start
```

On first launch, follow the terminal prompts to configure your tokens and channel ID.

---

### Running with Docker

1. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Start the container:
   ```bash
   docker compose up -d
   ```
3. Check logs:
   ```bash
   docker compose logs -f
   ```

---

### Notes

- **Discord Data Setting:** Ensure **"Use data to personalize my Discord experience"** is turned ON under `User Settings > Privacy & Safety` on the streaming account, or Discord will not count your hours.
- **Sync Delay:** Badge hours on your Discord profile may take a few hours to sync due to Discord's internal batching.
- **Disclaimer:** Automating user accounts violates Discord's Terms of Service. Use at your own discretion.

---

### License

MIT
