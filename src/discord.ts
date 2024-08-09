import { formatDuration, intervalToDuration } from "date-fns";
import { URL } from "url";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL as string;

export enum DiscordWebhookStatus {
  QUEUED,
  PROCESSING,
  DONE,
  ERROR,
}

const statusConfigs = {
  [DiscordWebhookStatus.QUEUED]: {
    color: 0xa855f7,
    label: "Queued",
  },
  [DiscordWebhookStatus.PROCESSING]: {
    color: 0xf97316,
    label: "Converting",
  },
  [DiscordWebhookStatus.DONE]: {
    color: 0x84cc16,
    label: "Done",
  },
  [DiscordWebhookStatus.ERROR]: {
    color: 0xef4444,
    label: "Error",
  },
};

export interface DiscordWebhook {
  id: string;
  status: DiscordWebhookStatus;
  inputFile: string;
  outputFile?: string;
  audioLanguage?: string;
  speed?: string;
  totalTime?: number;
  currentTime?: number;
  error?: string;
}

export interface CreateDiscordWebhook extends Omit<DiscordWebhook, "id"> {}

const formatSeconds = (seconds: number | undefined) => {
  if (seconds == null) return seconds;
  const duration = intervalToDuration({ start: 0, end: seconds * 1_000 });
  const parts = {
    h: duration.hours,
    m: duration.minutes,
    s: duration.seconds,
  };
  return Object.entries(parts)
    .filter(([_, v]) => v != null)
    .map(([key, v]) => `${v}${key}`)
    .join(" ");
};

const getProgressBar = (progress: number, size = 20) => {
  let bar = "";
  for (let i = 0; i < size; i += 1) {
    if (i / size < progress) {
      bar += "█";
    } else {
      bar += "░";
    }
  }
  return bar + ` ${(progress * 100).toFixed(1)}%`;
};

const formatDiscordWebhook = (data: CreateDiscordWebhook): string => {
  const status = statusConfigs[data.status];
  return JSON.stringify({
    embeds: [
      {
        title: "Converting file",
        color: status.color,
        timestamp: new Date().toISOString(),
        footer: {
          text: "Last update",
        },
        fields: [
          {
            name: "Status",
            value: status.label,
          },
          {
            name: "Input file",
            value: data.inputFile,
            inline: true,
          },
          {
            name: "Output file",
            value: data.outputFile,
            inline: true,
          },
          {
            name: "Audio language",
            value: data.audioLanguage,
            inline: true,
          },
          {
            name: "Speed",
            value: data.speed,
            inline: true,
          },
          {
            name: "Duration",
            value: formatSeconds(data.totalTime),
            inline: true,
          },
          {
            name: "Current Timestamp",
            value: formatSeconds(data.currentTime),
            inline: true,
          },
          data.totalTime != null && data.currentTime != null
            ? {
                name: "Progress",
                value: getProgressBar(data.currentTime / data.totalTime),
              }
            : null,
          data.error
            ? {
                name: "Error Message",
                value: `\`\`\`\n${data.error}\n\`\`\``,
              }
            : null,
        ].filter((f) => f != null && f.value != null),
      },
    ],
  });
};

interface FetchDiscordParam {
  path?: string;
  data: CreateDiscordWebhook;
  method: string;
}

const fetchDiscord = async ({
  path,
  data,
  method,
}: FetchDiscordParam): Promise<DiscordWebhook> => {
  let url: URL;
  if (path) {
    url = new URL(path, webhookUrl + "/");
  } else {
    url = new URL(webhookUrl);
  }
  url.searchParams.set("wait", "true");
  const response = await fetch(url.href, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: data ? formatDiscordWebhook(data) : undefined,
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(responseText);
  }
  const { id } = JSON.parse(responseText) as { id: string };
  return {
    ...data,
    id,
  };
};

export const createDiscordWebhook = async (data: CreateDiscordWebhook) => {
  return await fetchDiscord({ data, method: "POST" });
};

export const updateDiscordWebhook = async (webhook: DiscordWebhook) => {
  const { id, ...data } = webhook;
  try {
    return await fetchDiscord({
      path: `messages/${id}`,
      data,
      method: "PATCH",
    });
  } catch (e) {
    console.error(`Error while updating webhook:`);
    console.error(webhook);
    return webhook;
  }
};
