import { ffmpeg } from "./ffmpeg.ts";
import { ffprobe, type FFProbeStream } from "./ffprobe.ts";
import * as path from "path";
import {
  deleteMovieFile,
  importMovieFile,
  listLanguages,
  listMovieFolderFiles,
} from "./radarr.ts";
import { unlink } from "node:fs/promises";
import {
  notSubtitledStreamSelector,
  simpleLanguageStreamSelector,
} from "./streamSelectors.ts";
import {
  createDiscordWebhook,
  type DiscordWebhook,
  DiscordWebhookStatus,
  updateDiscordWebhook,
} from "./discord.ts";
import { getName } from "@cospired/i18n-iso-languages";

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
  const extname = path.extname(inputPath);
  if (extname === ".mp4") return;
  let { discordWebhook } = param;
  const folderPath = path.dirname(inputPath);
  const inputFileName = path.basename(inputPath);
  const outputFileName = inputFileName.replace(/\.\w+$/, ".mp4");
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
  let audioStream: FFProbeStream = audioStreams[audioStreams.length - 1];
  const streamSelectors = [
    simpleLanguageStreamSelector(videoStream.language),
    notSubtitledStreamSelector(probeResult),
  ];
  for (const streamSelector of streamSelectors) {
    const match = streamSelector(audioStreams);
    if (match) {
      audioStream = match;
      break;
    }
  }
  discordWebhook = await updateDiscordWebhook({
    ...discordWebhook,
    audioLanguage: audioStream.language,
    totalTime: probeResult.format.duration,
  });
  await ffmpeg({
    inputPath,
    outputPath,
    audioIndex: audioStream.typeIndex,
    discordWebhook,
  });
  await updateDiscordWebhook({
    ...discordWebhook,
    status: DiscordWebhookStatus.DONE,
    speed: undefined,
    currentTime: undefined,
  });
  await unlink(inputPath);
  const languages = await listLanguages();
  const audioLanguageName = getName(audioStream.language, "en");
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
    addFileToQueue(body);
    return new Response(undefined, { status: 200 });
  },
  port,
});

console.log("Listening on port:", port);

addFileToQueue({
  movie: {
    id: 123,
    folderPath: "movies",
  },
  movieFile: {
    id: 233,
    relativePath: "requiem.mkv",
  },
});
