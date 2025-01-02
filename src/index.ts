import { ffmpeg } from "./ffmpeg.ts";
import { ffprobe } from "./ffprobe.ts";
import * as path from "path";
import {
  deleteMovieFile,
  importMovieFile,
  listLanguages,
  listMovieFolderFiles,
} from "./radarr.ts";
import {
  createDiscordWebhook,
  type DiscordWebhook,
  DiscordWebhookStatus,
  updateDiscordWebhook,
} from "./discord.ts";
import { getName } from "@cospired/i18n-iso-languages";
import { unlink } from "node:fs/promises";

interface WebhookCall {
  movie: {
    id: number;
    folderPath: string;
  };
  movieFile: {
    id: number;
    relativePath: string;
  };
}

interface QueuedWebhookCall extends WebhookCall {
  discordWebhook: DiscordWebhook;
}

let queueBusy = false;
const queue: QueuedWebhookCall[] = [];

const next = async () => {
  if (queueBusy) return;
  const param = queue.pop();
  if (param == null) return;
  queueBusy = true;
  try {
    await handleFile(param);
  } catch (e) {
    console.error(e);
    param.discordWebhook.status = DiscordWebhookStatus.ERROR;
    if (e instanceof Error) {
      param.discordWebhook.error = e.message;
    } else {
      param.discordWebhook.error = "Unknown error";
    }
    await updateDiscordWebhook(param.discordWebhook);
  } finally {
    queueBusy = false;
    void next();
  }
};

const addFileToQueue = async (param: WebhookCall) => {
  console.log("Adding to queue:", param);
  queue.push({
    ...param,
    discordWebhook: await createDiscordWebhook({
      inputFile: param.movieFile.relativePath,
      status: DiscordWebhookStatus.QUEUED,
    }),
  });
  void next();
};

const handleFile = async (param: QueuedWebhookCall) => {
  const inputPath = path.join(
    process.env.LIBRARY_PATH as string,
    param.movie.folderPath,
    param.movieFile.relativePath,
  );
  let { discordWebhook } = param;
  const folderPath = path.dirname(inputPath);
  const inputFileName = path.basename(inputPath);
  const outputFileName = inputFileName.replace(/\.\w+$/, ".out.mp4");
  const outputPath = path.join(folderPath, outputFileName);
  discordWebhook = await updateDiscordWebhook({
    ...discordWebhook,
    status: DiscordWebhookStatus.PROCESSING,
    outputFile: outputFileName,
  });
  const probeResult = await ffprobe(inputPath);
  const { streams } = probeResult;
  const videoStream = streams.find((s) => s.type === "video");
  const audioStreams = streams.filter((s) => s.type === "audio");
  if (videoStream == null) return;
  const first = audioStreams[0];
  discordWebhook = await updateDiscordWebhook({
    ...discordWebhook,
    audioLanguage: first.language,
    totalTime: probeResult.format.duration,
  });
  await ffmpeg({
    inputPath,
    outputPath,
    audioIndex: audioStreams.map((s) => s.typeIndex),
    discordWebhook,
    streams,
  });
  await updateDiscordWebhook({
    ...discordWebhook,
    status: DiscordWebhookStatus.DONE,
    speed: undefined,
    currentTime: undefined,
  });
  await unlink(inputPath);
  const languages = await listLanguages();
  const audioLanguageName = getName(first.language, "en");
  if (audioLanguageName == null) {
    throw new Error("Could not find language");
  }
  const radarrLanguage = languages.find((l) => l.name === audioLanguageName);
  if (radarrLanguage == null) {
    throw new Error("Could not find language id");
  }
  const items = await listMovieFolderFiles({
    movieId: param.movie.id,
    folderPath: param.movie.folderPath,
  });
  const outputMovieFile = items.find((f) => f.relativePath === outputFileName);
  if (outputMovieFile) {
    await importMovieFile({
      folderName: outputMovieFile.folderName,
      path: outputMovieFile.path,
      movieId: param.movie.id,
      language: outputMovieFile.language,
      quality: outputMovieFile.quality,
      languages: [radarrLanguage],
    });
  }
  await deleteMovieFile(param.movieFile.id);
};

const port = process.env.PORT;

Bun.serve({
  fetch: async (request) => {
    if (request.method !== "POST") {
      return new Response(undefined, { status: 405 });
    }
    const body = (await request.json()) as WebhookCall;
    void addFileToQueue(body);
    return new Response(undefined, { status: 200 });
  },
  port,
});
