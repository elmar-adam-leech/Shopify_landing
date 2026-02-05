import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

async function getSessionToken(): Promise<string | null> {
  const app = (window as any).__SHOPIFY_APP_BRIDGE__;
  if (!app) return null;
  
  try {
    const { getSessionToken } = await import("@shopify/app-bridge/utilities");
    return await getSessionToken(app);
  } catch (error) {
    console.error("[QueryClient] Failed to get session token:", error);
    return null;
  }
}

async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
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
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const res = await authenticatedFetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
