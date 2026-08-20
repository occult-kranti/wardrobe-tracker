/**
 * Which faces are actually on screen. The root layout loads the bundled
 * TTFs with expo-font's useFonts and hands the result down; components ask
 * for families() instead of naming a fontFamily, so the fallback story
 * (docs/34 Phase 0 edge case: first-boot font fallback before load
 * completes) lives in exactly one place — typography.ts.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { families } from './typography';

type Families = ReturnType<typeof families>;

/** Defaults to the fallback faces so a component never renders nameless. */
const FontsContext = createContext<Families>(families(false));

export function FontsProvider({ loaded, children }: { loaded: boolean; children: ReactNode }) {
  const value = useMemo(() => families(loaded), [loaded]);
  return <FontsContext.Provider value={value}>{children}</FontsContext.Provider>;
}

export function useFamilies(): Families {
  return useContext(FontsContext);
}
