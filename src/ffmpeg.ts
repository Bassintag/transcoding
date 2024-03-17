import {$} from "bun";

export interface FfmpegOptions {
  inputPath: string;
  outputPath: string;
  audioIndex?: number;
}

export const ffmpeg = async ({inputPath, outputPath, audioIndex = 0}: FfmpegOptions) => {
  console.log("Convert:", inputPath, "to:", outputPath)
  await $`ffmpeg -y -v quiet -i ${inputPath} -map 0:v:0 -c:v copy -map 0:a:${audioIndex}? -c:a aac -map 0:s? -c:s mov_text ${outputPath}`.quiet();
}