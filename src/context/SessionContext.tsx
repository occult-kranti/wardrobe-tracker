import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ACCOUNTS_KEY,
  COMMUNITY_KEY,
  SESSION_KEY,
  adoptLegacyWardrobe,
  forgetWardrobe,
  loadAccounts,
  loadActiveId,
  loadCommunity,
  saveAccounts,
  saveActiveId,
  saveCommunity,
  saveWardrobe,
  loadTheme,
  saveTheme,
  THEME_KEY,
} from '../lib/accounts';
import { buildPersonaState, PERSONAS, PERSONA_SEED_VERSION } from '../lib/personaWardrobe';
import { seedCommunity } from '../lib/communitySeed';
import { initialState, type Account, type CommunityState, type Theme } from '../types';

/**
 * Which wardrobe is open, who else is on this device, and the little that is
 * shared between them.
 *
 * This sits ABOVE WardrobeProvider. Switching accounts remounts the wardrobe
 * provider (App keys it by the active id), so every page re-reads from the new
 * store without any page knowing accounts exist.
 */

interface SessionValue {
  accounts: Account[];
  activeId: string | null;
  active: Account | null;
  community: CommunityState;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  ready: boolean;
  signIn: (id: string) => void;
  signOut: () => void;
  createAccount: (draft: Omit<Account, 'id' | 'createdAt' | 'monogram' | 'color'> & { monogram?: string }) => Account;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  setCommunity: (next: CommunityState | ((prev: CommunityState) => CommunityState)) => void;
  /** Puts the three sample wardrobes on this device, if they are not already here. */
  installSamples: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/** The tag-avatar tints, kept to tokens the themes all define. */
const ACCOUNT_COLORS = [
  'var(--color-accent)',
  'var(--color-success)',
  'var(--color-gold)',
  'var(--color-warning)',
];

function monogramFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [community, setCommunityState] = useState<CommunityState>(() => loadCommunity());
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());
  const [ready, setReady] = useState(false);

  // First paint: read the registry, adopting any pre-accounts closet.
  useEffect(() => {
    let list = loadAccounts();
    // Samples written by an older seed are rebuilt in place: they are
    // demonstrations, and a demonstration showing last month's bugs teaches
    // the wrong lesson. Real wardrobes (no isSample) are never touched.
    let reseeded = false;
    list = list.map(account => {
      if (!account.isSample || account.seedVersion === PERSONA_SEED_VERSION) return account;
      const persona = PERSONAS.find(p => p.id === account.id);
      if (!persona) return account;
      saveWardrobe(persona.id, buildPersonaState(persona));
      reseeded = true;
      return { ...account, seedVersion: PERSONA_SEED_VERSION };
    });
    if (reseeded) {
      saveAccounts(list);
      // The shared layer reseeds with the wardrobes: seedCommunity is
      // idempotent (known-id checks), so existing posts, threads, households
      // and passes survive and only the missing seed rows arrive. Without
      // this, a browser that installed the samples last month would rebuild
      // three closets and never learn the households exist.
      const merged = seedCommunity(loadCommunity(), PERSONAS);
      saveCommunity(merged);
      setCommunityState(merged);
    }
    let adoptedId: string | null = null;
    if (list.length === 0) {
      const adopted = adoptLegacyWardrobe();
      if (adopted) {
        list = [adopted];
        adoptedId = adopted.id;
        saveAccounts(list);
      }
    }
    setAccounts(list);
    const stored = loadActiveId();
    if (stored && list.some(a => a.id === stored)) {
      setActiveId(stored);
    } else if (adoptedId) {
      // Someone who used this app before it held more than one wardrobe should
      // land in their closet, not at a chooser asking which of their one
      // wardrobe they meant.
      setActiveId(adoptedId);
      saveActiveId(adoptedId);
    } else {
      setActiveId(null);
    }
    setReady(true);
  }, []);

  // Another tab signing in or out should not leave this one showing a stale closet.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === ACCOUNTS_KEY) setAccounts(loadAccounts());
      if (e.key === SESSION_KEY) setActiveId(loadActiveId());
      if (e.key === COMMUNITY_KEY) setCommunityState(loadCommunity());
      if (e.key === THEME_KEY) setThemeState(loadTheme());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const persist = useCallback((list: Account[]) => {
    setAccounts(list);
    saveAccounts(list);
  }, []);

  const signIn = useCallback((id: string) => {
    setActiveId(id);
    saveActiveId(id);
  }, []);

  const signOut = useCallback(() => {
    setActiveId(null);
    saveActiveId(null);
  }, []);

  const createAccount = useCallback<SessionValue['createAccount']>(draft => {
    const id = `w-${crypto.randomUUID().slice(0, 8)}`;
    const account: Account = {
      ...draft,
      id,
      monogram: draft.monogram?.slice(0, 2).toUpperCase() || monogramFor(draft.name),
      color: ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    // A wardrobe starts genuinely empty — value at item #1 is the cold-start rule.
    saveWardrobe(id, initialState);
    persist([...accounts, account]);
    signIn(id);
    return account;
  }, [accounts, persist, signIn]);

  const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
    persist(accounts.map(a => (a.id === id ? { ...a, ...updates } : a)));
  }, [accounts, persist]);

  const removeAccount = useCallback((id: string) => {
    forgetWardrobe(id);
    const next = accounts.filter(a => a.id !== id);
    persist(next);
    if (activeId === id) signOut();
  }, [accounts, activeId, persist, signOut]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    saveTheme(next);
  }, []);

  const setCommunity = useCallback<SessionValue['setCommunity']>(next => {
    setCommunityState(prev => {
      const value = typeof next === 'function' ? next(prev) : next;
      saveCommunity(value);
      return value;
    });
  }, []);

  const installSamples = useCallback(() => {
    const existing = new Set(accounts.map(a => a.id));
    const added: Account[] = [];
    for (const persona of PERSONAS) {
      if (existing.has(persona.id)) continue;
      saveWardrobe(persona.id, buildPersonaState(persona));
      added.push({
        id: persona.id,
        name: persona.name,
        handle: persona.handle,
        city: persona.city,
        tagline: persona.philosophy[0],
        // No portrait: the identity mark stays a garment tag with a monogram.
        // The persona's own outfit photograph is shown on the profile as a look,
        // which is what it is — never cropped into a face beside a name.
        monogram: monogramFor(persona.name),
        color: ACCOUNT_COLORS[added.length % ACCOUNT_COLORS.length],
        createdAt: new Date().toISOString().slice(0, 10),
        isSample: true,
        seedVersion: PERSONA_SEED_VERSION,
      });
    }
    if (added.length === 0) return;
    persist([...accounts, ...added]);
    setCommunity(prev => seedCommunity(prev, PERSONAS));
  }, [accounts, persist, setCommunity]);

  const value = useMemo<SessionValue>(() => ({
    accounts,
    activeId,
    active: accounts.find(a => a.id === activeId) ?? null,
    community,
    theme,
    setTheme,
    ready,
    signIn,
    signOut,
    createAccount,
    updateAccount,
    removeAccount,
    setCommunity,
    installSamples,
  }), [accounts, activeId, community, theme, setTheme, ready, signIn, signOut, createAccount, updateAccount, removeAccount, setCommunity, installSamples]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
