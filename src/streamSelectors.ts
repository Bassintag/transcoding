import type { FFProbeResult, FFProbeStream } from "./ffprobe.ts";

export interface StreamSelector {
  (streams: FFProbeStream[]): FFProbeStream | null;
}

export const simpleLanguageStreamSelector = (
  ...languages: string[]
): StreamSelector => {
  return (streams) => {
    for (const stream of streams) {
      if (languages.includes(stream.language)) return stream;
    }
    return null;
  };
};

export const notSubtitledStreamSelector = (
  probeResult: FFProbeResult,
): StreamSelector => {
  const subtitleLanguages = probeResult.streams
    .filter((s) => s.type === "subtitle")
    .map((s) => s.language);
  return (streams) => {
    if (subtitleLanguages.length === 0) return null;
    for (const stream of streams) {
      if (!subtitleLanguages.includes(stream.language)) {
        return stream;
      }
    }
    return null;
  };
};
