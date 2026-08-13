import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { Button, Card, Field, LinkButton, inputClass } from '../components/ui';
import { Basting, TagMark, Wordmark } from '../components/art';
import { AccountMark } from '../components/social';
import { IconPlus } from '../components/icons';
import { byLastOpened, lastOpenedAt } from '../lib/accounts';
import { nameFor, safeNext } from '../lib/routes';
import type { Account } from '../types';

/**
 * THE DOOR — what "signing in" honestly is here.
 *
 * There is no server and no account system: this app keeps everything on the
 * device it runs on. So this screen does not authenticate anyone. It asks which
 * of the wardrobes stored in this browser to open, and it says so in as many
 * words, because the one thing the panel said would destroy trust is copy that
 * implies your clothes are going somewhere they are not.
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

export const SAMPLES_NOTE =
  'Samples are three worked closets — a full year of wear, saved looks, and a shared rail between them. Useful for seeing the populated screens before cataloguing your own.';

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
  const { createAccount } = useSession();
  const [name, setName] = useState('');

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    // Never disabled: a blank name becomes "Wardrobe", then "Wardrobe 2".
    // A disabled primary is a door that will not say what is wrong with it.
    createAccount({ name: name.trim() });
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
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button tone="primary" type="submit">Start it</Button>
      </div>
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
                <Button onClick={installSamples}>Or open the three sample wardrobes</Button>
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
              Nothing here leaves this device, so there is no password to keep. Choosing a wardrobe
              opens the records stored in this browser.
            </p>

            <NextNote next={next} />

            <WardrobeList accounts={accounts} onChoose={choose} />

            <Basting className="my-5" />

            <div className="flex flex-wrap items-center gap-3">
              <LinkButton to={`/open/new${suffix}`} tone="primary" icon={<IconPlus size={16} />}>
                Start a wardrobe
              </LinkButton>
              {accounts.some(a => a.isSample) ? null : (
                <Button onClick={installSamples}>Add the three sample wardrobes</Button>
              )}
            </div>
            {accounts.some(a => a.isSample) ? null : (
              <p className="type-ledger text-[11px] text-text-2 mt-4">{SAMPLES_NOTE}</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
