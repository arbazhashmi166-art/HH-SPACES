"use client";

import { create } from "zustand";

export const selectedSiteStorageKey = "hh-spaces.selectedSiteId";
export const adaptiveModeStorageKey = "hh-spaces.adaptiveMode";

type UiState = {
  mode: "light" | "dark";
  drawerOpen: boolean;
  quickAddOpen: boolean;
  activeFilter: string;
  selectedSiteId: string;
  adaptiveMode: boolean;
  setMode: (mode: "light" | "dark") => void;
  toggleMode: () => void;
  setDrawerOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean) => void;
  setActiveFilter: (filter: string) => void;
  setSelectedSiteId: (siteId: string) => void;
  setAdaptiveMode: (enabled: boolean) => void;
  toggleAdaptiveMode: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  mode: "light",
  drawerOpen: false,
  quickAddOpen: false,
  activeFilter: "",
  selectedSiteId: "",
  adaptiveMode: true,
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((state) => ({ mode: state.mode === "light" ? "dark" : "light" })),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  setSelectedSiteId: (selectedSiteId) => {
    if (typeof window !== "undefined") {
      if (selectedSiteId) window.localStorage.setItem(selectedSiteStorageKey, selectedSiteId);
      else window.localStorage.removeItem(selectedSiteStorageKey);
    }
    set({ selectedSiteId });
  },
  setAdaptiveMode: (adaptiveMode) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(adaptiveModeStorageKey, adaptiveMode ? "1" : "0");
    }
    set({ adaptiveMode });
  },
  toggleAdaptiveMode: () => {
    set((state) => {
      const adaptiveMode = !state.adaptiveMode;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(adaptiveModeStorageKey, adaptiveMode ? "1" : "0");
      }
      return { adaptiveMode };
    });
  }
}));
