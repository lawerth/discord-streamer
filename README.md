

<div align="center">
<h1>🎮 Discord Streamer</h1>

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![WebRTC](https://img.shields.io/badge/Discord-WebRTC%20Stream-5865F2.svg)](https://discord.com)

**An automated, ultra-lightweight booster to farm hours for Discord's new progressive Streaming Profile Badge.**

Featuring an interactive first-run CLI setup wizard, live session dashboard, and continuous 24/7 background streaming with 0.1% CPU usage.

</div>

---

## 📖 About The Streaming Badge

Discord recently introduced experimental progressive Activity Badges on user profiles. One of the rarest and most sought-after is the **Streaming Badge**, which evolves through **10 milestone tiers** based on total hours spent broadcasting to at least one active viewer.

### 🏆 Badge Milestones & Tiers

| Tier | Badge Level | Required Stream Time |
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

> [!IMPORTANT]
> **Viewer Requirement:** Discord only registers hours if another user is actively watching your stream. This tool solves this by running an automated **Viewer (Alt)** account that joins the channel and sends continuous Gateway `STREAM_WATCH` (Opcode 20) packets.

---

## ✨ Features

- **⚡ Ultra-Low Resource Profile:** Automatically loops a 1 FPS / 15 kbps dummy video file (~4 KB). Runs continuously on budget 512MB VPS instances without burning CPU or bandwidth.
- **💾 Auto-Persistence & Profile Detection:** Remembers your streamed hours across restarts and automatically detects if you've already unlocked a badge tier on your profile.
- **🛠️ Interactive First-Run Wizard:** No manual `.env` editing needed. The CLI asks for your tokens and channel IDs, verifies them directly with Discord's API, and saves them automatically.
- **📊 Modern Terminal Dashboard:** Live session counter, active progress bars, time remaining to the next badge tier, and real-time activity logs.
- **🔄 Auto-Reconnect & Fault-Tolerant:** Automatically recovers from Discord voice server drops, internet hiccups, and voice disconnects/kicks.
- **📦 Zero-Config FFmpeg:** Powered by `ffmpeg-static`, which automatically injects platform-specific FFmpeg binaries without manual installations.
- **🐳 Docker Ready:** Includes `Dockerfile` and `docker-compose.yml` for effortless 24/7 background hosting.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18 or higher)
- Two Discord accounts:
  - **Streamer Account:** Your main account that earns the badge.
  - **Viewer Account:** A secondary / alt account that watches the stream.

### 2. Installation

Clone this repository and install dependencies:

```bash
git clone https://github.com/your-username/discord-streamer.git
cd discord-streamer
npm install
```

### 3. Launch

```bash
npm start
```

If you are running the project for the first time, the **Interactive Setup Wizard** will guide you step-by-step:
1. Enter your **Streamer Token** (Main Account).
2. Enter your **Viewer Token** (Alt Account).
3. Enter the **Discord Server (Guild) ID**.
4. Enter the **Voice Channel ID**.

Tokens are verified in real-time with Discord's API and saved to `.env`.

---

## 🐳 Running with Docker (24/7 VPS Hosting)

If you have a Linux VPS and want to leave it running 24/7:

1. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   nano .env
   ```
2. Start the container in detached mode:
   ```bash
   docker compose up -d
   ```
3. View the live dashboard logs:
   ```bash
   docker compose logs -f
   ```

---

## ⚠️ Important Requirements & Settings

### 1. Enable Discord Telemetry
For Discord to log your streaming hours towards the badge, ensure this setting is enabled on your **Streamer** account:
> **User Settings** ➔ **Privacy & Safety** ➔ Turn **ON**: *"Use data to personalize my Discord experience"*

### 2. Stats Sync Delay
Discord aggregates activity badge data via backend analytics pipelines. Hours may take anywhere from **2 to 24 hours** to reflect on your public profile card.

---

## 🔒 Security & Terms of Service Disclaimer

This tool is created for educational and experimental purposes. Using selfbots or automated user account tokens violates **Discord's Terms of Service**. Use secondary / burner accounts for testing whenever possible. The author assumes no responsibility for any account restrictions or bans resulting from the use of this software.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
