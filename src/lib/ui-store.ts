"use client";

import { create } from "zustand";

export const selectedSiteStorageKey = "hh-spaces.selectedSiteId";

function readSelectedSite() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem(selectedSiteStorageKey) || "";
}

type UiState = {
  mode: "light" | "dark";
  drawerOpen: boolean;
  quickAddOpen: boolean;
  activeFilter: string;
  selectedSiteId: string;
  setMode: (mode: "light" | "dark") => void;
  toggleMode: () => void;
  setDrawerOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean) => void;
  setActiveFilter: (filter: string) => void;
  setSelectedSiteId: (siteId: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  mode: "light",
  drawerOpen: false,
  quickAddOpen: false,
  activeFilter: "",
  selectedSiteId: readSelectedSite(),
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
  }
}));
