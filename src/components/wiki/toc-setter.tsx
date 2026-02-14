"use client";

import { useEffect } from "react";
import { useToc } from "./toc-context";
import type { TocEntry } from "./table-of-contents";

/**
 * Invisible client component that pushes TOC entries into context
 * so the sidebar can display them. Cleans up on unmount.
 */
export function TocSetter({ entries }: { entries: TocEntry[] }) {
  const { setEntries } = useToc();

  useEffect(() => {
    setEntries(entries);
    return () => setEntries([]);
  }, [entries, setEntries]);

  return null;
}
