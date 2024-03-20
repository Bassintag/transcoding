import { $ } from "bun";

export interface FFProbeStream {
  index: number;
  codec: string;
  type: string;
  typeIndex: number;
  language: string;
}

export interface FFProbeResult {
  streams: FFProbeStream[];
}

export const ffprobe = async (path: string): Promise<FFProbeResult> => {
  console.log("Probing file:", path);
  const probe =
    await $`ffprobe -v quiet -print_format json -show_streams ${path}`.quiet();
  const data = probe.json() as { streams: any[] };
  console.log(data);
  let currentType: string = "video";
  let index = 0;
  for (const stream of data.streams) {
    if (stream.codec_type !== currentType) {
      currentType = stream.codec_type;
      index = 0;
    } else {
      index += 1;
    }
    stream.type_index = index;
  }
  return {
    streams: data.streams.map((s) => ({
      index: s.index,
      codec: s.codec_name,
      type: s.codec_type,
      typeIndex: s.type_index,
      language: s.tags?.language ?? "und",
    })),
  };
};
