import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * The record, on the device.
 *
 * Two things about writing it matter more here than in an app with a server
 * behind it, because there is no server behind it:
 *
 * 1. WRITING MUST NOT HAPPEN INSIDE THE STATE UPDATER. It used to: every
 *    setValue serialised the entire wardrobe — every piece, every wear log,
 *    every base64 photograph — synchronously, inside the reducer. On a 300-
 *    piece closet with photographs that is megabytes of string per keystroke
 *    typed into a note, and React is free to call an updater more than once,
 *    so it was megabytes twice. The write now happens in an effect, once per
 *    committed state, coalesced across a burst of edits.
 *
 * 2. A FAILED WRITE MUST BE SAID OUT LOUD. It used to be swallowed: quota
 *    exceeded left the app looking perfectly normal with the last hour of work
 *    living only in memory, and a refresh threw it away. That is the failure
 *    every rival's reviews describe as "it won't save", and the one thing this
 *    app cannot do quietly. `onError` carries it to the surface.
 *
 * The coalescing window is short, and any pending write is flushed on unmount
 * and when the page is hidden — closing a tab must never be able to lose an
 * edit made a moment before.
 */

/** Long enough to swallow a burst of keystrokes, short enough to feel instant. */
const SETTLE_MS = 250;

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  /** Runs on every read so stored data from any older version loads intact. */
  migrate?: (raw: unknown) => T,
  /** Told when the device refuses the write, so the app can say so. */
  onError?: (error: unknown) => void,
): [T, (value: T | ((prev: T) => T)) => void] {
  const read = useCallback((serialized: string | null): T => {
    if (!serialized) return initialValue;
    try {
      const parsed = JSON.parse(serialized);
      return migrate ? migrate(parsed) : (parsed as T);
    } catch {
      return initialValue;
    }
    // initialValue/migrate are stable for this app's single provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      return read(window.localStorage.getItem(key));
    } catch {
      return initialValue;
    }
  });

  // What still needs writing, and the timer that will write it. Held in refs so
  // the flush path can reach them from an event handler or a cleanup.
  const pending = useRef<{ key: string; value: T } | null>(null);
  const timer = useRef<number | null>(null);
  const errored = useRef(false);
  const report = useRef(onError);
  report.current = onError;

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    try {
      window.localStorage.setItem(job.key, JSON.stringify(job.value));
      errored.current = false;
    } catch (e) {
      // Said once per run of trouble, not once per keystroke.
      if (!errored.current) {
        errored.current = true;
        report.current?.(e);
      }
    }
  }, []);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    // The updater is now pure: it computes the next state and nothing else.
    setStoredValue(prev => (value instanceof Function ? value(prev) : value));
  }, []);

  // One write per committed state, coalesced. The first pass after mount is
  // skipped: it would only rewrite exactly what was just read.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    pending.current = { key, value: storedValue };
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SETTLE_MS);
  }, [key, storedValue, flush]);

  // Closing the tab, switching apps, or unmounting must not drop a pending
  // write. pagehide fires where beforeunload does not, on iOS especially.
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key) setStoredValue(read(e.newValue));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, read]);

  return [storedValue, setValue];
}
