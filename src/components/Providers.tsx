"use client";

import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { useUiStore } from "@/lib/ui-store";
import { PwaRegister } from "./PwaRegister";
import { OnlineSync } from "./OnlineSync";

export function Providers({ children }: { children: ReactNode }) {
  const mode = useUiStore((state) => state.mode);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.classList.toggle("ion-palette-dark", mode === "dark");
    root.style.colorScheme = mode;
  }, [mode]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OnlineSync />
        <PwaRegister />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
