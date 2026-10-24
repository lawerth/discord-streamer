<p align="center">
  <img src="assets/banner.png" alt="Discord Streamer" width="100%">
</p>

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![WebRTC](https://img.shields.io/badge/Discord-WebRTC%20Stream-5865F2.svg)](https://discord.com)

Level up your badge effortlessly with automated audience emulation, ultra-low resource usage, and real-time milestone tracking.

</div>

---

## 📖 About The Streaming Badge

Discord features progressive **Activity Badges** that dynamically evolve on user profiles. The **Streaming Badge** is the longest grind on the platform, requiring up to **5,000+ hours** of broadcast time in front of an active audience to reach the ultimate **Phenomenon** tier.

### 🏆 Badge Milestones & Tiers

| Tier | Badge Level | Required Stream Time |
| :---: | :--- | :---: |
| 1 | <img src="assets/badges/01_newcomer.png" width="24" height="24" valign="middle" /> **Newcomer** | **1 Hour** |
| 2 | <img src="assets/badges/02_fledgling.png" width="24" height="24" valign="middle" /> **Fledgling** | **5 Hours** |
| 3 | <img src="assets/badges/03_breakout.png" width="24" height="24" valign="middle" /> **Breakout** | **20 Hours** |
| 4 | <img src="assets/badges/04_standout.png" width="24" height="24" valign="middle" /> **Standout** | **75 Hours** |
| 5 | <img src="assets/badges/05_trendsetter.png" width="24" height="24" valign="middle" /> **Trendsetter** | **150 Hours** |
| 6 | <img src="assets/badges/06_headliner.png" width="24" height="24" valign="middle" /> **Headliner** | **300 Hours** |
| 7 | <img src="assets/badges/07_superstar.png" width="24" height="24" valign="middle" /> **Superstar** | **500 Hours** |
| 8 | <img src="assets/badges/08_sensation.png" width="24" height="24" valign="middle" /> **Sensation** | **1,000 Hours** |
| 9 | <img src="assets/badges/09_visionary.png" width="24" height="24" valign="middle" /> **Visionary** | **2,000 Hours** |
| 10 | <img src="assets/badges/10_phenomenon.png" width="24" height="24" valign="middle" /> **Phenomenon** | **5,000+ Hours** |

> [!NOTE]
> **Audience Requirement:** Discord only counts hours when someone is actively watching your broadcast. Streaming in an empty voice channel does **not** count. **Discord Streamer** solves this by pairing your streamer with an automated **Viewer (Alt)** account that maintains a full WebRTC voice connection and real-time RTC media stream subscription (Gateway `STREAM_WATCH` Opcode 20 + stream RTC socket `IDENTIFY`), ensuring Discord's media servers register a genuine active viewer.

---

## ✨ Features

- **⚡ Ultra-Low Resource Usage:** Broadcasts an optimized 10 FPS dynamic video loop with a stereo audio track (~150 kbps). Uses less than **1% CPU** per streamer and minimal bandwidth, making it ideal for 24/7 hosting on the cheapest VPS.
- **📡 Built-in Science & Telemetry Engine:** Automatically simulates official Discord desktop client analytics (`media_session_joined`, `video_stream_started`, periodic `video_stream_heartbeat`, and `video_stream_ended`) to `/api/v9/science` with authentic desktop super-properties, ensuring hours are processed by Discord's activity badge pipeline.
- **👥 Multi-Streamer & Active Audience Emulation:** Farm multiple accounts simultaneously! A single viewer account joins via WebRTC and actively watches all streamers in the voice channel, boosting all badges at once.
- **🛡️ Self-Healing Auto-Reconnect:** Instantly recovers and rejoins if any account gets disconnected, moved, or kicked from the voice channel.
- **💻 Live CLI Dashboard:** Clean terminal UI displaying per-streamer uptime, accumulated hours, current badge tiers, and live progress bars toward milestones.
- **💾 Smart Persistence & Profile Sync:** Saves farmed time locally and checks your Discord profile to keep stats synchronized across sessions and reboots.
- **📦 Zero External Dependencies:** FFmpeg is bundled via `ffmpeg-static`—no manual installation or PATH configuration required.
- **🐳 1-Command Docker Setup:** Fully containerized with `docker-compose.yml` for effortless 24/7 background deployment.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18 or higher)
- Discord accounts:
  - **Streamer Account(s):** One or more accounts that broadcast and earn the badge.
  - **Viewer Account:** A single secondary / alt account to watch the streams.
- A voice channel where all accounts have **Connect** and **Video / Stream** permissions.

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/lawerth/discord-streamer.git
cd discord-streamer
npm install
```

### 3. Launch

```bash
npm start
```

On first run, the **Interactive Setup Wizard** will prompt you for:
1. **Streamer Token(s)** (Main accounts, separated by commas if multiple)
2. **Viewer Token** (Alt Account)
3. **Discord Server (Guild) ID**
4. **Voice Channel ID**

> **Tip:** Enable **Developer Mode** in Discord (`User Settings > Advanced > Developer Mode`) to easily right-click any server or voice channel to copy IDs.

Your tokens are verified with Discord's API and saved locally to `.env`.

---

## 🐳 Running with Docker

To run continuously in the background on a server or VPS:

1. Copy the example environment file and configure your credentials:
   ```bash
   cp .env.example .env
   nano .env
   ```
2. Start the container in detached mode:
   ```bash
   docker compose up -d
   ```
3. View real-time logs anytime:
   ```bash
   docker compose logs -f
   ```

---

## ⚠️ Important Requirements & Settings

### 1. Enable Discord Telemetry
For Discord to log your streaming activity towards the badge, ensure this setting is turned **ON** on your **Streamer** account:
> **User Settings** ➔ **Privacy & Safety** ➔ **How We Use Your Data** ➔ Turn **ON**: *"Use data to personalize my Discord experience"*

### 2. Profile Sync Delay
Discord processes activity badge milestones in scheduled backend batches. It may take **2 to 24 hours** for your accumulated hours to visibly update on your public profile card.

---

## 🔒 Disclaimer

This project is created for educational and experimental purposes. Automating user accounts (selfbots) violates **Discord's Terms of Service**. Use at your own discretion, and prefer using secondary / alt accounts for testing. The author assumes no liability for any account restrictions or bans.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
