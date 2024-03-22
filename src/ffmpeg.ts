import { spawn } from "bun";
import { type DiscordWebhook, updateDiscordWebhook } from "./discord.ts";

export interface FfmpegOptions {
  inputPath: string;
  outputPath: string;
  discordWebhook: DiscordWebhook;
  audioIndex?: number;
}

export const ffmpeg = async ({
  inputPath,
  outputPath,
  audioIndex = 0,
  discordWebhook,
}: FfmpegOptions) => {
  console.log("Convert:", inputPath, "to:", outputPath);
  return new Promise<void>(async (resolve, reject) => {
    const proc = spawn(
      [
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
        "-map",
        `0:a:${audioIndex}?`,
        "-c:a",
        "aac",
        "-map",
        "0:s?",
        "-c:s",
        "mov_text",
        outputPath,
      ],
      {
        onExit: (_, code) => {
          console.log("EXIT:", code);
          if (code === 0) {
            resolve();
          } else {
            reject();
          }
        },
      },
    );
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
