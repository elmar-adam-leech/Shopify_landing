import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getSessionToken } from "./session-token";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getShopContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    shop: params.get("shop"),
    host: params.get("host"),
    isEmbedded: !!params.get("shop") && !!params.get("host"),
  };
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { shop, isEmbedded } = getShopContext();
  
  const fetchUrl = new URL(url, window.location.origin);
  if (shop) {
    fetchUrl.searchParams.set("shop", shop);
  }
  
  const headers = new Headers(options.headers);
  
  if (isEmbedded) {
    const token = await getSessionToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  
  return fetch(fetchUrl.toString(), {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const res = await authenticatedFetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    signal: options?.signal,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await authenticatedFetch(queryKey.join("/") as string, {});

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
