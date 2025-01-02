import type { FFProbeResult, FFProbeStream } from "./ffprobe.ts";

export interface StreamSelector {
  (streams: FFProbeStream[]): FFProbeStream[];
}

export const simpleLanguageStreamSelector = (
  ...languages: string[]
): StreamSelector => {
  return (streams) => {
    return streams.filter((stream) => languages.includes(stream.language));
  };
};

export const notSubtitledStreamSelector = (
  probeResult: FFProbeResult,
): StreamSelector => {
  const subtitleLanguages = probeResult.streams
    .filter((s) => s.type === "subtitle")
    .map((s) => s.language);
  return (streams) => {
    if (subtitleLanguages.length === 0) return [];
    return streams.filter(
      (stream) => !subtitleLanguages.includes(stream.language),
    );
  };
};
