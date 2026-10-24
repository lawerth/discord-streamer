import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export function injectFFmpegPath() {
  let ffmpegBin = ffmpegStatic;

  if (ffmpegBin && fs.existsSync(ffmpegBin)) {
    const ffmpegDir = path.dirname(ffmpegBin);
    const pathSeparator = process.platform === "win32" ? ";" : ":";
    const currentPath = process.env.PATH || "";

    if (!currentPath.includes(ffmpegDir)) {
      process.env.PATH = `${ffmpegDir}${pathSeparator}${currentPath}`;
    }
  } else {
    ffmpegBin = "ffmpeg";
  }

  process.env.FFMPEG_PATH = ffmpegBin;
  return ffmpegBin;
}

export async function ensureDummyMedia() {
  const ffmpegPath = injectFFmpegPath();
  const assetsDir = path.resolve(process.cwd(), "assets");

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const dummyVideoPath = path.join(assetsDir, "dummy_stream.mp4");

  if (fs.existsSync(dummyVideoPath) && fs.statSync(dummyVideoPath).size > 50000) {
    return dummyVideoPath;
  }

  const ffmpegArgs = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=5:size=480x270:rate=10",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-t",
    "5",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    "150k",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    dummyVideoPath,
  ];

  await execFileAsync(ffmpegPath, ffmpegArgs);
  return dummyVideoPath;
}
