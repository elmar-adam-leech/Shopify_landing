"use client";

import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { StoreProvider } from "@/lib/store-context";
import { useState } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            queryFn: async ({ queryKey }) => {
              const res = await fetch(queryKey[0] as string);
              if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`);
              }
              return res.json();
            },
          },
        },
      })
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <StoreProvider>
              <TooltipProvider>
                <Toaster />
                {children}
              </TooltipProvider>
            </StoreProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
