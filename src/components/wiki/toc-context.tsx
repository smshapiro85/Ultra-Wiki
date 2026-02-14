"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { TocEntry } from "./table-of-contents";

interface TocContextValue {
  entries: TocEntry[];
  setEntries: (entries: TocEntry[]) => void;
}

const TocContext = createContext<TocContextValue>({
  entries: [],
  setEntries: () => {},
});

export function TocProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntriesState] = useState<TocEntry[]>([]);

  const setEntries = useCallback((newEntries: TocEntry[]) => {
    setEntriesState(newEntries);
  }, []);

  return (
    <TocContext.Provider value={{ entries, setEntries }}>
      {children}
    </TocContext.Provider>
  );
}

export function useToc() {
  return useContext(TocContext);
}
