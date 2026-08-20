import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  applyTheme,
  stampOpened,
  uniqueWardrobeName,
  handleFor,
  hasLegacyWardrobe,
  THEME_KEY,
} from '../lib/accounts';
import { pruneCommunity } from '../lib/admin';
import { buildPersonaState, PERSONAS, PERSONA_SEED_VERSION } from '../lib/personaWardrobe';
import { mergeCommunity, normalizeCommunity, seedCommunity } from '../lib/communitySeed';
import { mergeSchedule } from '../lib/feedEngine';
import { todayLocal } from '@almari/shared/dates';
import {
  announceAdopted,
  accountFromRow,
  deleteRemote,
  flushQueue,
  pullAll,
  stampSynced,
} from '../lib/sync';
import {
  currentAuthUser,
  onAuthChange,
  signInWithEmail,
  signOutAuth,
  signUpWithEmail,
  type AuthResult,
  type AuthUser,
} from '../lib/supabase';
import { initialState, type Account, type CommunityState, type Theme } from '@almari/shared/types';

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
  /** Who is signed into the Supabase account, if anyone. Independent of which
      wardrobe is open — the account and the wardrobes are separate ideas. */
  authUser: AuthUser | null;
  /** False until the stored session has been checked once, so no screen has to
      render a signed-out panel and then flinch into a signed-in one. */
  authReady: boolean;
  signInEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpEmail: (email: string, password: string) => Promise<AuthResult>;
  /** Ends the account session. Deletes nothing, here or there. */
  signOutAccount: () => Promise<void>;
  createAccount: (
    draft: Omit<Account, 'id' | 'createdAt' | 'monogram' | 'color' | 'handle'>
      & { monogram?: string; handle?: string },
  ) => Account;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  setCommunity: (next: CommunityState | ((prev: CommunityState) => CommunityState)) => void;
  /** Puts the sample wardrobes on this device, if they are not already here. */
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
  // localStorage is synchronous, so the registry is read in the initializers
  // rather than in an effect. Reading it a frame later meant the very first
  // paint of every load was a frame of nothing.
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const stored = loadActiveId();
    return stored && loadAccounts().some(a => a.id === stored) ? stored : null;
  });
  const [community, setCommunityState] = useState<CommunityState>(() => normalizeCommunity(loadCommunity()));
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());
  // Only a pre-accounts closet awaiting adoption holds the door shut, and only
  // for the one tick the adoption takes.
  const [ready, setReady] = useState(() => !hasLegacyWardrobe());

  /* ---------- the account (Supabase), wholly optional ---------- */
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // The account effect below reads these through refs so that it subscribes
  // once and never re-runs on an accounts change — a pull that ADDS accounts
  // would otherwise retrigger itself.
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;

  const persist = useCallback((list: Account[]) => {
    setAccounts(list);
    saveAccounts(list);
  }, []);

  /**
   * What a sign-in sets in motion, in order: anything the offline queue was
   * holding goes up, every row on the account comes down. Known wardrobes
   * reconcile newer-wins (pullAll writes their stores); rows this device has
   * never seen are introduced as new wardrobes — that is the entire point of
   * the account, a closet on more than one device.
   */
  const afterSignIn = useCallback(async (user: AuthUser) => {
    await flushQueue(user.id).catch(() => {});
    const { adoptedIds, fresh } = await pullAll(accountsRef.current);
    if (fresh.length > 0) {
      const existing = new Set(accountsRef.current.map(a => a.id));
      const base = accountsRef.current.length;
      const added: Account[] = fresh.map((row, i) => {
        let id = `w-${crypto.randomUUID().slice(0, 8)}`;
        while (existing.has(id)) id = `w-${crypto.randomUUID().slice(0, 8)}`;
        existing.add(id);
        saveWardrobe(id, row.state);
        stampSynced(id, row.updated_at);
        return accountFromRow(row, {
          id,
          handle: handleFor(row.name),
          monogram: monogramFor(row.name),
          color: ACCOUNT_COLORS[(base + i) % ACCOUNT_COLORS.length],
          createdAt: todayLocal(),
        });
      });
      persist([...accountsRef.current, ...added]);
    }
    // If an adopted wardrobe is the one open, its provider must re-read.
    for (const id of adoptedIds) announceAdopted(id);
  }, [persist]);

  /**
   * The account session: restored once at boot, then followed. A pull runs
   * once per signed-in user per load — TOKEN_REFRESHED re-runs would only
   * re-ask what was just answered, and SIGNED_IN after SIGNED_OUT must pull
   * again, which the reset below allows.
   */
  const pulledFor = useRef<string | null>(null);
  useEffect(() => {
    let mounted = true;
    void currentAuthUser().then(user => {
      if (!mounted) return;
      setAuthUser(user);
      setAuthReady(true);
      if (user && pulledFor.current !== user.id) {
        pulledFor.current = user.id;
        void afterSignIn(user);
      }
    });
    const unsubscribe = onAuthChange((event, user) => {
      setAuthUser(user);
      if (event === 'SIGNED_OUT') pulledFor.current = null;
      if (event === 'SIGNED_IN' && user && pulledFor.current !== user.id) {
        pulledFor.current = user.id;
        void afterSignIn(user);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [afterSignIn]);

  // Back online: the queue of pushes that could not be sent goes out, oldest
  // dirt first. Without a signed-in account there is nowhere to send to.
  useEffect(() => {
    const onOnline = () => {
      const user = authUserRef.current;
      if (user) void flushQueue(user.id).catch(() => {});
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // The theme is stamped here rather than in Layout, whose scope never covered
  // the signed-out screens: the door had no theme at all and the whole screen
  // flipped on sign-in.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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

    /* The shared layer, then the living feed on top of it.
       seedCommunity is idempotent (known-id checks), so a reseed adds only the
       rows that are missing — without it, a browser that installed the samples
       last month would rebuild three closets and never learn the households
       exist. mergeSchedule runs on EVERY boot, reseeded or not: the personas'
       schedules derive from today's date, so that same browser still gets this
       morning's posts and prunes last month's. Only installed samples post — a
       persona whose wardrobe was never put on this device contributes nothing.
       The write to storage happens in the effect keyed on `community`, never
       inside a state updater. */
    const installed = new Set(list.filter(a => a.isSample).map(a => a.id));
    let shared = normalizeCommunity(loadCommunity());
    if (reseeded) shared = seedCommunity(shared, PERSONAS);
    setCommunityState(mergeSchedule(shared, PERSONAS.filter(p => installed.has(p.id)), todayLocal()));
    setReady(true);
  }, []);

  // The shared store's write lives in exactly one place: an effect keyed on
  // the committed state. The old code wrote localStorage inside the React
  // state updater, which StrictMode runs twice and which made the write
  // hostage to render timing.
  useEffect(() => {
    saveCommunity(community);
  }, [community]);

  // Another tab signing in or out should not leave this one showing a stale closet.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === ACCOUNTS_KEY) setAccounts(loadAccounts());
      if (e.key === SESSION_KEY) setActiveId(loadActiveId());
      // Merge, never replace: the other tab's blob predates whatever this tab
      // wrote since it loaded, and wholesale replacement is how two tabs that
      // each posted something erased each other's writes. A merge that changes
      // nothing returns the same object, so no write — and no reply event —
      // comes of it.
      if (e.key === COMMUNITY_KEY) {
        const incoming = normalizeCommunity(loadCommunity());
        setCommunityState(prev => mergeCommunity(prev, incoming));
      }
      if (e.key === THEME_KEY) setThemeState(loadTheme());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const signIn = useCallback((id: string) => {
    setActiveId(id);
    saveActiveId(id);
    stampOpened(id);
  }, []);

  const signOut = useCallback(() => {
    setActiveId(null);
    saveActiveId(null);
  }, []);

  const createAccount = useCallback<SessionValue['createAccount']>(draft => {
    const id = `w-${crypto.randomUUID().slice(0, 8)}`;
    // A blank name is never a dead end: it becomes "Wardrobe", then
    // "Wardrobe 2". The primary button is therefore never disabled.
    const name = draft.name.trim() || uniqueWardrobeName('Wardrobe', accounts);
    const account: Account = {
      ...draft,
      name,
      handle: draft.handle?.trim() || handleFor(name),
      id,
      monogram: draft.monogram?.slice(0, 2).toUpperCase() || monogramFor(name),
      color: ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length],
      createdAt: todayLocal(),
      // A synced wardrobe's remote row id is minted here, once, so the first
      // push has somewhere stable to land even if it happens offline-queued.
      ...(draft.sync === 'cloud' && !draft.syncId ? { syncId: crypto.randomUUID() } : {}),
    };
    // A wardrobe starts genuinely empty — value at item #1 is the cold-start rule.
    saveWardrobe(id, initialState);
    const next = [...accounts, account];
    // Opened in the same write, not via signIn(): signIn maps over an
    // `accounts` that does not yet contain this one, and would persist the
    // list without it.
    persist(next);
    setActiveId(id);
    saveActiveId(id);
    stampOpened(id);
    return account;
  }, [accounts, persist]);

  const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
    persist(accounts.map(a => (a.id === id ? { ...a, ...updates } : a)));
  }, [accounts, persist]);

  const removeAccount = useCallback((id: string) => {
    forgetWardrobe(id);
    const leaving = accounts.find(a => a.id === id);
    const next = accounts.filter(a => a.id !== id);
    persist(next);
    if (activeId === id) signOut();
    // The retired wardrobe's community rows go with it — the portal's two
    // deletion paths already prune, and a thread of ghosts named "Someone"
    // is the review finding this call closes for the tester-facing path.
    pruneCommunity([id]);
    // A synced wardrobe's remote copy goes with it — "retired" must not leave
    // the closet standing on the account. Best-effort; offline it outlives
    // this device, never the reverse.
    if (leaving) void deleteRemote(leaving);
  }, [accounts, activeId, persist, signOut]);

  const signInEmail = useCallback((email: string, password: string) =>
    signInWithEmail(email, password), []);
  const signUpEmail = useCallback((email: string, password: string) =>
    signUpWithEmail(email, password), []);
  const signOutAccount = useCallback(() => signOutAuth(), []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    saveTheme(next);
  }, []);

  // The write is the effect's job, keyed on the state this produces — never
  // inside the updater, which React may run twice or throw away.
  const setCommunity = useCallback<SessionValue['setCommunity']>(next => {
    setCommunityState(next);
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
        createdAt: todayLocal(),
        isSample: true,
        seedVersion: PERSONA_SEED_VERSION,
      });
    }
    if (added.length === 0) return;
    persist([...accounts, ...added]);
    // The feed wakes the moment the samples land, not on the next boot.
    const nowInstalled = new Set([...accounts, ...added].filter(a => a.isSample).map(a => a.id));
    setCommunity(prev =>
      mergeSchedule(seedCommunity(prev, PERSONAS), PERSONAS.filter(p => nowInstalled.has(p.id)), todayLocal()));
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
    authUser,
    authReady,
    signInEmail,
    signUpEmail,
    signOutAccount,
    createAccount,
    updateAccount,
    removeAccount,
    setCommunity,
    installSamples,
  }), [accounts, activeId, community, theme, setTheme, ready, signIn, signOut, authUser, authReady, signInEmail, signUpEmail, signOutAccount, createAccount, updateAccount, removeAccount, setCommunity, installSamples]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
