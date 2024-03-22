import { $ } from "bun";

export interface FFProbeStream {
  index: number;
  codec: string;
  type: string;
  typeIndex: number;
  language: string;
}

export interface FFProbeFormat {
  duration: number;
}

export interface FFProbeResult {
  streams: FFProbeStream[];
  format: FFProbeFormat;
}

export const ffprobe = async (path: string): Promise<FFProbeResult> => {
  console.log("Probing file:", path);
  const probe =
    await $`ffprobe -v quiet -print_format json -show_streams -show_format ${path}`.quiet();
  const data = probe.json() as { streams: any[]; format: any };
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
    format: {
      duration: parseFloat(data.format.duration),
    },
  };
};
