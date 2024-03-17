import { ffmpeg } from "./ffmpeg.ts";
import { ffprobe } from "./ffprobe.ts";
import * as path from "path";
import {
  deleteMovieFile,
  importMovieFile,
  listMovieFolderFiles,
} from "./radarr.ts";
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

let queueBusy = false;
const queue: WebhookCall[] = [];

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

const addFileToQueue = (param: WebhookCall) => {
  queue.push(param);
  void next();
};

const handleFile = async (param: WebhookCall) => {
  const inputPath = path.join(
    process.env.LIBRARY_PATH as string,
    param.movie.folderPath,
    param.movieFile.relativePath,
  );
  const extname = path.extname(inputPath);
  if (extname === ".mp4") return;
  const folderPath = path.dirname(inputPath);
  const inputFileName = path.basename(inputPath);
  const outputFileName = inputFileName.replace(/\.\w+$/, ".mp4");
  const outputPath = path.join(folderPath, outputFileName);

  const { streams } = await ffprobe(inputPath);
  const videoStream = streams.find((s) => s.type === "video");
  const audioStreams = streams.filter((s) => s.type === "audio");
  if (videoStream == null) return;
  let audioIndex: number = 0;
  const preferredLanguages = [videoStream.language, "eng", "fra", "fre"];
  for (const language of preferredLanguages) {
    const match = audioStreams.find((s) => s.language === language);
    if (match) {
      audioIndex = match.typeIndex;
      break;
    }
  }
  await ffmpeg({
    inputPath,
    outputPath,
    audioIndex,
  });
  await unlink(inputPath);
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
