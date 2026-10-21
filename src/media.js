import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export function injectFFmpegPath() {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static binary not found.");
  }

  const ffmpegDir = path.dirname(ffmpegStatic);
  const pathSeparator = process.platform === "win32" ? ";" : ":";

  if (!process.env.PATH.includes(ffmpegDir)) {
    process.env.PATH = `${ffmpegDir}${pathSeparator}${process.env.PATH}`;
  }

  process.env.FFMPEG_PATH = ffmpegStatic;
  return ffmpegStatic;
}

export async function ensureDummyMedia() {
  const ffmpegPath = injectFFmpegPath();
  const assetsDir = path.resolve(process.cwd(), "assets");

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const dummyVideoPath = path.join(assetsDir, "dummy_stream.mp4");

  if (fs.existsSync(dummyVideoPath) && fs.statSync(dummyVideoPath).size > 0) {
    return dummyVideoPath;
  }

  const ffmpegArgs = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=320x240:r=1",
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
    "-tune",
    "stillimage",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    "15k",
    "-c:a",
    "aac",
    "-b:a",
    "16k",
    dummyVideoPath,
  ];

  await execFileAsync(ffmpegPath, ffmpegArgs);
  return dummyVideoPath;
}
