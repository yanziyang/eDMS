import { getShareToken } from "@/features/share-links/token";
import type { ProblemDetails, RefreshResponse } from "@/types/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5080/api/v1";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

function shareTokenHeaders(): Record<string, string> {
  const token = getShareToken();
  return token ? { "X-Share-Token": token } : {};
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.title ?? problem.detail ?? "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let problem: ProblemDetails = { title: response.statusText };
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      // non-JSON error body
    }
    return new ApiError(response.status, problem);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        setAccessToken(null);
        return false;
      }

      const data = (await response.json()) as RefreshResponse;
      setAccessToken(data.accessToken);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers ?? {}),
      ...shareTokenHeaders(),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  const skipRefresh = [
    "/auth/login",
    "/auth/refresh",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/sso/exchange",
  ].some((prefix) => path.startsWith(prefix));

  if (response.status === 401 && !skipRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, init);
    }
    throw new ApiError(401, { title: "Unauthorized" });
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function requestRaw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.headers ?? {}),
      ...shareTokenHeaders(),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestRaw<T>(path, init);
    }
    throw new ApiError(401, { title: "Unauthorized" });
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function requestBlob(path: string): Promise<Blob> {
  let response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...shareTokenHeaders(),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        headers: {
          ...shareTokenHeaders(),
          Authorization: `Bearer ${accessToken!}`,
        },
      });
    }
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  // Rebuild the blob from the raw bytes so the returned instance always matches
  // the environment's global Blob (Node's fetch may hand back a different Blob
  // implementation across versions, breaking instanceof checks and consumers).
  const data = await response.arrayBuffer();
  return new Blob([data], {
    type: response.headers.get("content-type") ?? "application/octet-stream",
  });
}
