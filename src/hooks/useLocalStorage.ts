import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  /** Runs on every read so stored data from any older version loads intact. */
  migrate?: (raw: unknown) => T
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

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch {
        // Quota exceeded or storage disabled — keep the in-memory state usable.
      }
      return valueToStore;
    });
  }, [key]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key) setStoredValue(read(e.newValue));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, read]);

  return [storedValue, setValue];
}
