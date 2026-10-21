import fs from "fs";
import path from "path";
import { BADGE_TIERS } from "./constants.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const STATS_FILE = path.join(DATA_DIR, "stats.json");

export function loadStats() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
      return {
        totalSeconds: Number(data.totalSeconds) || 0,
        lastBadgeTier: Number(data.lastBadgeTier) || 0,
      };
    }
  } catch {}

  return { totalSeconds: 0, lastBadgeTier: 0 };
}

export function saveStats(stats) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(
      STATS_FILE,
      JSON.stringify(
        {
          totalSeconds: Math.floor(stats.totalSeconds || 0),
          lastBadgeTier: Number(stats.lastBadgeTier || 0),
          lastUpdated: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch {}
}

export async function detectProfileStreamingBadge(userId, token) {
  try {
    const res = await fetch(`https://discord.com/api/v9/users/${userId}/profile?with_mutual_guilds=false`, {
      headers: {
        Authorization: token.trim(),
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const badges = data.badges || [];

    for (const badge of badges) {
      const id = (badge.id || "").toLowerCase();
      const desc = (badge.description || "").toLowerCase();

      const isStreamBadge =
        id.includes("stream") ||
        id.includes("golive") ||
        id.includes("go_live") ||
        desc.includes("stream");

      if (isStreamBadge) {
        for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
          const tier = BADGE_TIERS[i];
          if (
            id.includes(`lvl${tier.tier}`) ||
            id.includes(`tier_${tier.tier}`) ||
            id.includes(`tier${tier.tier}`) ||
            id.includes(`${tier.hours}_hour`) ||
            desc.includes(`${tier.hours} hour`)
          ) {
            return tier;
          }
        }
        return BADGE_TIERS[0];
      }
    }

    return null;
  } catch {
    return null;
  }
}
