export const BADGE_TIERS = [
  { tier: 1, name: "Newcomer", hours: 1, icon: "🖥️", color: "#B9BBBE" },
  { tier: 2, name: "Fledgling", hours: 5, icon: "🟢", color: "#57F287" },
  { tier: 3, name: "Breakout", hours: 20, icon: "🍏", color: "#3BA55D" },
  { tier: 4, name: "Standout", hours: 75, icon: "🐬", color: "#00E5FF" },
  { tier: 5, name: "Trendsetter", hours: 150, icon: "🌊", color: "#00A8FC" },
  { tier: 6, name: "Headliner", hours: 300, icon: "🔷", color: "#5865F2" },
  { tier: 7, name: "Superstar", hours: 500, icon: "🟣", color: "#9B59B6" },
  { tier: 8, name: "Sensation", hours: 1000, icon: "🌸", color: "#EB459E" },
  { tier: 9, name: "Visionary", hours: 2000, icon: "🌺", color: "#ED4245" },
  { tier: 10, name: "Phenomenon", hours: 5000, icon: "👑", color: "#FEE75C" },
];

export const ASCII_BANNER = `
          ██████╗ ██╗███████╗ ██████╗ ██████╗ ██████╗ ██████╗ 
          ██╔══██╗██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗
          ██║  ██║██║███████╗██║     ██║   ██║██████╔╝██║  ██║
          ██║  ██║██║╚════██║██║     ██║   ██║██╔══██╗██║  ██║
          ██████╔╝██║███████║╚██████╗╚██████╔╝██║  ██║██████╔╝
          ╚═════╝ ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ 

  ███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗███████╗██████╗ 
  ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║██╔════╝██╔══██╗
  ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║█████╗  ██████╔╝
  ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║██╔══╝  ██╔══██╗
  ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║███████╗██║  ██║
  ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
`;

export function getBadgeProgress(totalHoursStreamed) {
  let currentTier = null;
  let nextTier = BADGE_TIERS[0];

  for (let i = 0; i < BADGE_TIERS.length; i++) {
    if (totalHoursStreamed >= BADGE_TIERS[i].hours) {
      currentTier = BADGE_TIERS[i];
      nextTier = BADGE_TIERS[i + 1] || null;
    } else {
      if (!currentTier) {
        nextTier = BADGE_TIERS[i];
      }
      break;
    }
  }

  const prevHours = currentTier ? currentTier.hours : 0;
  const nextHours = nextTier ? nextTier.hours : 5000;
  const neededHours = nextTier ? Math.max(0, nextTier.hours - totalHoursStreamed) : 0;

  const progressPercent = nextTier
    ? Math.min(100, Math.max(0, ((totalHoursStreamed - prevHours) / (nextHours - prevHours)) * 100))
    : 100;

  return {
    currentTier,
    nextTier,
    progressPercent: Number(progressPercent.toFixed(1)),
    neededHours: Number(neededHours.toFixed(2)),
  };
}
