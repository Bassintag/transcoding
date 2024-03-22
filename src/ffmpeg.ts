import { spawn } from "bun";
import { type DiscordWebhook, updateDiscordWebhook } from "./discord.ts";
import type { FFProbeStream } from "./ffprobe.ts";

export interface FfmpegOptions {
  inputPath: string;
  outputPath: string;
  discordWebhook: DiscordWebhook;
  streams: FFProbeStream[];
  audioIndex?: number;
}

const acceptedSubtitleCodecs = ["srt", "mov_text"];

export const ffmpeg = async ({
  inputPath,
  outputPath,
  audioIndex = 0,
  streams,
  discordWebhook,
}: FfmpegOptions) => {
  console.log("Convert:", inputPath, "to:", outputPath);
  const cmd = [
    "ffmpeg",
    "-y",
    "-v",
    "error",
    "-progress",
    "-",
    "-stats_period",
    "5",
    "-nostats",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-c:v",
    "copy",
  ];
  if (audioIndex != null) {
    cmd.push("-map", `0:a:${audioIndex}`, "-c:a", "aac");
  }
  const subStreams = streams.filter(
    (s) => s.type === "subtitle" && acceptedSubtitleCodecs.includes(s.codec),
  );
  if (subStreams.length > 0) {
    for (const stream of subStreams) {
      cmd.push("-map", `0:s:${stream.typeIndex}`);
    }
    cmd.push("-c:s", "mov_text");
  }
  cmd.push(outputPath);
  console.log(cmd.join(" "));
  return new Promise<void>(async (resolve, reject) => {
    const proc = spawn(cmd, {
      onExit: (_, code) => {
        if (code === 0) {
          resolve();
        } else {
          reject();
        }
      },
    });
    const decoder = new TextDecoder();
    for await (const part of proc.stdout) {
      const data = decoder.decode(part);
      for (const line of data.split("\n")) {
        const parts = line.split("=");
        if (parts.length !== 2) continue;
        const [key, value] = parts;
        switch (key) {
          case "speed":
            discordWebhook.speed = value;
            break;
          case "out_time_ms":
            discordWebhook.currentTime = parseInt(value) / 1_000_000;
            break;
        }
      }
      await updateDiscordWebhook(discordWebhook);
    }
  });
};
