import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { Button, Card, Field, LinkButton, inputClass } from '../components/ui';
import { Basting, TagMark, Wordmark } from '../components/art';
import { AccountMark } from '../components/social';
import { IconEyelet, IconEyeletFilled, IconPlus } from '../components/icons';
import { byLastOpened, lastOpenedAt } from '../lib/accounts';
import { PERSONAS } from '../lib/personaWardrobe';
import { nameFor, safeNext } from '../lib/routes';
import type { Account, SyncMode } from '../types';

/**
 * THE DOOR — what "signing in" honestly is here.
 *
 * Two different acts share this screen, and the copy keeps them apart:
 *
 *   1. OPENING A WARDROBE asks which of the wardrobes stored in this browser
 *      to open. It authenticates no one; it never did.
 *   2. THE ACCOUNT, below, is optional and does one thing: keeps a copy of a
 *      synced wardrobe's record so another device can open it. The app works
 *      fully without it, and the panel says so in as many words, because the
 *      one thing this screen must never imply is that clothes are going
 *      somewhere they were not asked to go.
 *
 * Three states, decided by what is on the device rather than by a mode flag:
 *   nothing here   → the screen IS the start form, plus the sample offer
 *   one or more    → "Open a wardrobe", with the list
 *   /open/new      → the form, with a way back to the list
 *
 * The old version rendered in place of the router, which is why a deep link
 * while nothing was open left the address bar saying /feed over a door: the
 * URL and the screen disagreed, and the back button had to be pressed once per
 * disagreement. The router now sits above the gate and this is a real route.
 */

export const START_LEDE =
  'It begins empty, on this device. Only a name is needed — everything else can wait until there is something to say.';

// The count is derived, not written down — a number in prose goes stale the
// day a persona is added, and this line already had to be corrected once.
export const SAMPLES_NOTE =
  `Samples are ${PERSONAS.length} worked closets — a full year of wear, saved looks, and a shared rail between them. Useful for seeing the populated screens before cataloguing your own.`;

/** What the door is holding for you, if you arrived by a deep link. */
function NextNote({ next }: { next: string | null }) {
  if (!next) return null;
  const name = nameFor(next.split('?')[0]);
  return (
    <p className="type-ledger text-[11px] text-text-2 mt-4">
      {name ? `${name[0].toUpperCase()}${name.slice(1)}` : 'That page'} is inside a wardrobe.
      Open one and you will land there.
    </p>
  );
}

/** "today", "3 days ago", or nothing at all. */
function openedPhrase(id: string): string | null {
  const at = lastOpenedAt(id);
  if (!at) return null;
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  if (days <= 0) return 'Last opened today';
  if (days === 1) return 'Last opened yesterday';
  if (days < 30) return `Last opened ${days} days ago`;
  return 'Last opened a while ago';
}

/**
 * THE ACCOUNT PANEL — the whole of what an account is for, said to its face.
 *
 * An account exists for exactly one reason: keeping the record of a wardrobe
 * you choose on more than one device. It is not a membership, it unlocks no
 * feature, and the app works fully without one. The copy says so every time
 * the panel appears, because the one thing it must never imply is that the
 * clothes are going somewhere they were not asked to go.
 *
 * Used on the Door, in Settings, and inline where a synced wardrobe is chosen
 * while signed out.
 */
export function AccountPanel({ idPrefix = 'acct' }: { idPrefix?: string }) {
  const { authUser, authReady, signInEmail, signUpEmail, signOutAccount } = useSession();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  // Until the stored session has been checked once, render nothing rather
  // than a signed-out panel that flinches into a signed-in one.
  if (!authReady) return null;

  if (authUser) {
    return (
      <div>
        <p className="text-[15px] text-text leading-tight break-all">Signed in as {authUser.email}</p>
        <p className="text-[13px] text-text-2 leading-snug mt-2">
          Synced wardrobes keep a copy on this account. Signing out ends that and deletes nothing —
          every wardrobe on this device stays exactly as it is.
        </p>
        <div className="mt-3">
          <Button onClick={() => { void signOutAccount(); }}>Sign out</Button>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNote(null);
    const result = mode === 'in'
      ? await signInEmail(email.trim(), password)
      : await signUpEmail(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setNote({ text: result.error, error: true });
      return;
    }
    // A live session announces itself through the session context and this
    // panel becomes the signed-in view on its own. needsConfirm means the
    // account exists but the email must be answered first — say which.
    if (result.needsConfirm) {
      setNote({ text: 'The account is made. Confirm it from the email that just arrived, then sign in.', error: false });
    }
  };

  return (
    <div>
      <p className="text-[14px] text-text-2 leading-relaxed">
        Almari works entirely on this device, and that does not change. An account does one thing:
        it keeps a copy of a synced wardrobe&rsquo;s record, so another device can open it. No
        newsletter, nothing sold, nothing nags. It runs on the owner&rsquo;s Supabase free tier and
        costs you nothing; any change would be announced in advance.
      </p>
      <form className="space-y-5 mt-4" onSubmit={e => { void submit(e); }}>
        <Field label="Email" htmlFor={`${idPrefix}-email`}>
          <input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@wherever.com"
          />
        </Field>
        <Field
          label="Password"
          htmlFor={`${idPrefix}-password`}
          hint={mode === 'up' ? 'At least 6 characters.' : undefined}
        >
          <input
            id={`${idPrefix}-password`}
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            className={inputClass}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" disabled={busy || !email.trim() || !password}>
            {busy ? 'One moment' : mode === 'in' ? 'Sign in' : 'Make the account'}
          </Button>
          <button
            type="button"
            className="type-label text-accent underline underline-offset-[3px] decoration-1 hover:decoration-2 min-h-11 px-1"
            onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setNote(null); }}
          >
            {mode === 'in' ? 'New here? Make an account' : 'Already have one? Sign in'}
          </button>
        </div>
        {note ? (
          <p className={`text-[13px] leading-snug ${note.error ? 'text-danger' : 'text-text-2'}`}>
            {note.text}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/** A 44px pressed-state choice, in the shape of the settings toggles. */
export function Choice({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPress}
      className={`h-11 px-3 type-label inline-flex items-center justify-center gap-2 rounded-[2px] border transition-colors duration-150 ${
        active
          ? 'bg-ink text-on-ink border-transparent'
          : 'border-border text-text-2 hover:text-text hover:bg-sunken'
      }`}
    >
      <span className={active ? 'text-accent-on-ink' : 'opacity-60'}>
        {active ? <IconEyeletFilled size={10} /> : <IconEyelet size={10} />}
      </span>
      {children}
    </button>
  );
}

export function WardrobeList({
  accounts,
  activeId,
  onChoose,
}: {
  accounts: Account[];
  activeId?: string | null;
  onChoose: (id: string) => void;
}) {
  // Yours first, most recently opened at the top. Samples go in their own
  // lower group under a heading, so no row has to wear the word "sample".
  const mine = accounts.filter(a => !a.isSample).sort(byLastOpened);
  const samples = accounts.filter(a => a.isSample).sort(byLastOpened);

  const row = (account: Account) => {
    const open = account.id === activeId;
    // One ledger clause list. The "open" marker used to float at the right and
    // collide with a wrapping meta line on a narrow screen.
    const meta = [account.handle, account.city, open ? 'open now' : openedPhrase(account.id)]
      .filter(Boolean)
      .join(' · ');
    return (
      <li key={account.id}>
        <button
          type="button"
          onClick={() => onChoose(account.id)}
          aria-current={open ? 'true' : undefined}
          className="w-full flex items-center gap-4 min-h-[72px] py-2 text-left group"
        >
          <AccountMark account={account} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] text-text group-hover:underline underline-offset-[3px] truncate">
              {account.name}
            </span>
            <span className="type-ledger text-[11px] text-text-2 block mt-1">{meta}</span>
            {account.tagline ? (
              <span className="text-[13px] text-text-2 block mt-1 line-clamp-1">{account.tagline}</span>
            ) : null}
          </span>
        </button>
      </li>
    );
  };

  return (
    <>
      {mine.length > 0 ? <ul className="mt-6">{mine.map(row)}</ul> : null}
      {samples.length > 0 ? (
        <>
          {mine.length > 0 ? <Basting className="my-4" /> : null}
          <p className="type-ledger text-[11px] text-text-2 mt-6 mb-1">Worked examples</p>
          <ul>{samples.map(row)}</ul>
        </>
      ) : null}
    </>
  );
}

export function StartWardrobeForm({ onDone }: { onDone?: () => void }) {
  const { createAccount, authUser } = useSession();
  const [name, setName] = useState('');
  const [sync, setSync] = useState<SyncMode>('device');
  const [hint, setHint] = useState<string | null>(null);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    // A synced wardrobe without a signed-in account would be a promise made
    // and instantly broken — say what is missing instead of starting it.
    if (sync === 'cloud' && !authUser) {
      setHint('Sign in above first — a synced wardrobe needs the account it syncs to. Or keep the record on this device.');
      return;
    }
    // Never disabled: a blank name becomes "Wardrobe", then "Wardrobe 2".
    // A disabled primary is a door that will not say what is wrong with it.
    createAccount({ name: name.trim(), sync });
    onDone?.();
  };

  return (
    <form className="space-y-5 mt-6" onSubmit={start}>
      <Field label="Name" htmlFor="su-name">
        <input
          id="su-name"
          className={inputClass}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="What to call this wardrobe"
          autoFocus
        />
      </Field>

      {/* Where the record lives — asked once, at the start. The default is
          where every wardrobe has always lived. */}
      <div>
        <p className="type-ledger text-[11px] text-text-2">Where the record lives</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Choice active={sync === 'device'} onPress={() => { setSync('device'); setHint(null); }}>
            On this device
          </Choice>
          <Choice active={sync === 'cloud'} onPress={() => { setSync('cloud'); setHint(null); }}>
            Synced to my account
          </Choice>
        </div>
        <p className="text-[13px] text-text-2 leading-snug mt-2">
          {sync === 'device'
            ? 'Kept in this browser only — how Almari has always worked.'
            : 'A copy is kept on your account, updated as you work, so another device can open it. The app is the same either way.'}
        </p>
      </div>

      {sync === 'cloud' && !authUser ? (
        <div className="rounded-[2px] border border-border bg-sunken p-4">
          <p className="type-ledger text-[11px] text-text-2 mb-3">Syncing needs the account it syncs to</p>
          <AccountPanel idPrefix="start-acct" />
        </div>
      ) : null}
      {sync === 'cloud' && authUser ? (
        <p className="type-ledger text-[11px] text-text-2">Signed in as {authUser.email} — the wardrobe will sync to that account.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button tone="primary" type="submit">Start it</Button>
      </div>
      {hint ? <p className="text-[13px] text-danger leading-snug">{hint}</p> : null}
      <p className="type-ledger text-[11px] text-text-2">
        A handle, a city and a line about how you dress can be added later, from Wardrobes.
      </p>
    </form>
  );
}

export default function Door({ starting = false }: { starting?: boolean }) {
  const { accounts, signIn, installSamples } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const suffix = next ? `?next=${encodeURIComponent(next)}` : '';
  const empty = accounts.length === 0;
  const showForm = starting || empty;

  // replace, so the door does not stay behind you in history.
  const land = () => navigate(next ?? '/', { replace: true });
  const choose = (id: string) => {
    signIn(id);
    land();
  };

  return (
    <div className="min-h-dvh bg-bg pattern-paper flex items-start sm:items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <header className="flex items-center gap-3 mb-8">
          <TagMark size={40} />
          <div>
            <Wordmark className="w-[96px]" />
            <p className="type-editorial text-[14px] text-text-2 mt-1">Your wardrobe, on record.</p>
          </div>
        </header>

        {showForm ? (
          <Card>
            <h1 className="type-masthead text-[24px] pb-2 rule-double">Start a wardrobe</h1>
            <p className="text-[14px] text-text-2 mt-4 leading-relaxed">{START_LEDE}</p>
            <NextNote next={next} />
            <StartWardrobeForm onDone={land} />

            {empty ? (
              <>
                <Basting className="my-5" />
                <Button onClick={installSamples}>Or open the sample wardrobes</Button>
                <p className="type-ledger text-[11px] text-text-2 mt-4">{SAMPLES_NOTE}</p>
              </>
            ) : (
              <>
                <Basting className="my-5" />
                <Link to={`/open${suffix}`} className="text-[14px] text-text-2 underline underline-offset-[3px]">
                  Back to the wardrobes on this device
                </Link>
              </>
            )}
          </Card>
        ) : (
          <Card>
            <h1 className="type-masthead text-[24px] pb-2 rule-double">Open a wardrobe</h1>
            <p className="text-[14px] text-text-2 mt-4 leading-relaxed">
              Choosing a wardrobe opens the records stored in this browser — synced or not, they
              are kept here first.
            </p>

            <NextNote next={next} />

            <WardrobeList accounts={accounts} onChoose={choose} />

            <Basting className="my-5" />

            <div className="flex flex-wrap items-center gap-3">
              <LinkButton to={`/open/new${suffix}`} tone="primary" icon={<IconPlus size={16} />}>
                Start a wardrobe
              </LinkButton>
              {accounts.some(a => a.isSample) ? null : (
                <Button onClick={installSamples}>Add the sample wardrobes</Button>
              )}
            </div>
            {accounts.some(a => a.isSample) ? null : (
              <p className="type-ledger text-[11px] text-text-2 mt-4">{SAMPLES_NOTE}</p>
            )}
          </Card>
        )}

        {/* The optional account, offered once and calmly. Never a gate. */}
        <Card className="mt-5">
          <h2 className="type-editorial text-[20px]">An account, if you want one</h2>
          <div className="mt-4">
            <AccountPanel />
          </div>
        </Card>
      </div>
    </div>
  );
}
