"use client";

import { create } from "zustand";

type UiState = {
  mode: "light" | "dark";
  drawerOpen: boolean;
  quickAddOpen: boolean;
  activeFilter: string;
  setMode: (mode: "light" | "dark") => void;
  toggleMode: () => void;
  setDrawerOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean) => void;
  setActiveFilter: (filter: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  mode: "light",
  drawerOpen: false,
  quickAddOpen: false,
  activeFilter: "",
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((state) => ({ mode: state.mode === "light" ? "dark" : "light" })),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
  setActiveFilter: (activeFilter) => set({ activeFilter })
}));
