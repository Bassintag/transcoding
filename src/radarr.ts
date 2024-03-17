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
    Authorization: process.env.RADARR_API_KEY as string,
  };
  const init: RequestInit = {
    ...rest,
    headers,
  };
  if (json) {
    headers["Content-Type"] = "applications/json";
    init.body = JSON.stringify(json);
  }
  const response = await fetch(url.href, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
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
