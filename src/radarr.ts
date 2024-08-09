export interface FetchRadarrInit {
  json?: unknown;
  method?: string;
}

export const fetchRadarr = async <T>(
  path: string,
  { json, ...rest }: FetchRadarrInit = {},
) => {
  const url = new URL(path, process.env.RADARR_URL);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Api-Key": process.env.RADARR_API_KEY as string,
  };
  const init: RequestInit = {
    ...rest,
    headers,
  };
  if (json) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  }
  console.log("[OUTGOING]", url.href, init);
  const response = await fetch(url.href, init);
  const data = await response.text();
  console.log("[INCOMING]", url.href, response.status, data);
  if (!response.ok) {
    throw new Error(data);
  }
  if (data.length < 0) {
    return undefined as T;
  }
  return JSON.parse(data) as T;
};

export interface ListMovieFolderFilesParam {
  movieId: number;
  folderPath: string;
}

export const listMovieFolderFiles = ({
  movieId,
  folderPath,
}: ListMovieFolderFilesParam) => {
  return fetchRadarr<any[]>(
    `/api/v3/manualimport?movieId=${movieId}&folder=${folderPath}&filterExistingFiles=false`,
  );
};

export interface RadarrLanguage {
  id: number;
  name: string;
}

export const listLanguages = () => {
  return fetchRadarr<RadarrLanguage[]>("/api/v3/language");
};

export const importMovieFile = async (file: any) => {
  return fetchRadarr("/api/v3/command", {
    method: "POST",
    json: {
      files: [file],
      importMode: "auto",
      name: "ManualImport",
    },
  });
};

export const deleteMovieFile = (id: number) => {
  return fetchRadarr(`/api/v3/moviefile/${id}`, {
    method: "DELETE",
  });
};
