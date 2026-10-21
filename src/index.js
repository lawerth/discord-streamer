import chalk from "chalk";
import { loadConfig } from "./config.js";
import { Dashboard } from "./dashboard.js";
import { StreamEngine } from "./engine.js";

async function main() {
  try {
    const config = await loadConfig();

    console.clear();

    const dashboard = new Dashboard(config);
    dashboard.render();

    let engine = null;
    const tickInterval = setInterval(() => {
      if (engine) {
        engine.tick();
      } else {
        dashboard.render();
      }
    }, 1000);

    engine = new StreamEngine(config, dashboard);
    await engine.start();

    let isExiting = false;
    const handleExit = () => {
      if (isExiting) return;
      isExiting = true;
      clearInterval(tickInterval);
      dashboard.addLog("Exiting cleanly...", "warn");
      if (engine) engine.stop();
      console.log(chalk.yellow("\nDisconnected from Discord. Exiting.\n"));
      process.exit(0);
    };

    process.on("SIGINT", handleExit);
    process.on("SIGTERM", handleExit);
  } catch (error) {
    console.error(chalk.red("\nFatal error:"), error);
    process.exit(1);
  }
}

main();
