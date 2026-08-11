import { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { Button, Card, Field, inputClass } from '../components/ui';
import { Basting, TagMark, Wordmark } from '../components/art';
import { IconPlus } from '../components/icons';
import type { Account } from '../types';

/**
 * CHOOSING A WARDROBE — what "signing in" honestly is here.
 *
 * There is no server and no account system: this app keeps everything on the
 * device it runs on. So this screen does not authenticate anyone. It asks which
 * of the wardrobes stored in this browser to open, and it says so in as many
 * words, because the one thing the panel said would destroy trust is copy that
 * implies your clothes are going somewhere they are not.
 */

function Portrait({ account, size = 56 }: { account: Account; size?: number }) {
  if (account.portrait) {
    return (
      <span
        className="block shrink-0 bg-mat overflow-hidden rounded-[2px]"
        style={{ width: size, height: size * 1.25 }}
      >
        <img src={account.portrait} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 40 50" aria-hidden="true" className="shrink-0">
      <path d="M6 1h28l5 5v43H1V6z" fill="var(--color-sunken)" stroke="var(--color-border)" strokeWidth="1" />
      <circle cx="20" cy="9" r="3" fill="none" stroke={account.color} strokeWidth="1.5" />
      <text x="20" y="35" textAnchor="middle" fill="var(--color-text)" style={{ font: '600 15px var(--font-display)' }}>
        {account.monogram}
      </text>
    </svg>
  );
}

export default function SignIn() {
  const { accounts, signIn, createAccount, installSamples } = useSession();
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [city, setCity] = useState('');
  const [tagline, setTagline] = useState('');

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createAccount({
      name: trimmed,
      // Everything but a name is optional — a required field is a field that
      // erases whoever cannot answer it.
      handle: handle.trim() || `@${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
      city: city.trim() || undefined,
      tagline: tagline.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-bg pattern-paper flex items-start sm:items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <header className="flex items-center gap-3 mb-8">
          <TagMark size={40} />
          <div>
            <Wordmark className="w-[96px]" />
            <p className="type-editorial text-[14px] text-text-2 mt-1">Your wardrobe, on record.</p>
          </div>
        </header>

        {making ? (
          <Card>
            <h1 className="type-masthead text-[24px] pb-2 rule-double">Start a wardrobe</h1>
            <p className="text-[14px] text-text-2 mt-4 leading-relaxed">
              It begins empty, on this device. Only a name is needed — everything else can wait until
              there is something to say.
            </p>
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
              <Field label="Handle" htmlFor="su-handle" hint="Optional. Used where a short name fits better.">
                <input id="su-handle" className={inputClass} value={handle} onChange={e => setHandle(e.target.value)} placeholder="@yourname" />
              </Field>
              <Field label="City" htmlFor="su-city" hint="Optional. It only shapes the weather notes.">
                <input id="su-city" className={inputClass} value={city} onChange={e => setCity(e.target.value)} placeholder="Where you dress" />
              </Field>
              <Field label="One line about how you dress" htmlFor="su-line" hint="Optional. Shown on your profile.">
                <input id="su-line" className={inputClass} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Mends before replacing" />
              </Field>
              <div className="flex items-center gap-3 pt-1">
                <Button tone="primary" type="submit" disabled={!name.trim()}>Start it</Button>
                <Button type="button" onClick={() => setMaking(false)}>Back</Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card>
            <h1 className="type-masthead text-[24px] pb-2 rule-double">Open a wardrobe</h1>
            <p className="text-[14px] text-text-2 mt-4 leading-relaxed">
              Nothing here leaves this device, so there is no password to keep. Choosing a wardrobe
              opens the records stored in this browser.
            </p>

            {accounts.length > 0 ? (
              <ul className="mt-6">
                {accounts.map(account => (
                  <li key={account.id}>
                    <button
                      type="button"
                      onClick={() => signIn(account.id)}
                      className="w-full flex items-center gap-4 min-h-[72px] py-2 text-left group"
                    >
                      <Portrait account={account} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] text-text group-hover:underline underline-offset-[3px]">
                          {account.name}
                        </span>
                        <span className="type-ledger text-[11px] text-text-2 block mt-1">
                          {account.handle}
                          {account.city ? ` · ${account.city}` : ''}
                          {account.isSample ? ' · sample' : ''}
                        </span>
                        {account.tagline ? (
                          <span className="text-[13px] text-text-2 block mt-1 line-clamp-1">{account.tagline}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-editorial text-[20px] leading-snug text-balance mt-6">
                No wardrobes on this device yet.
              </p>
            )}

            <Basting className="my-5" />

            <div className="flex flex-wrap items-center gap-3">
              <Button tone="primary" icon={<IconPlus size={16} />} onClick={() => setMaking(true)}>
                Start a wardrobe
              </Button>
              {accounts.some(a => a.isSample) ? null : (
                <Button onClick={installSamples}>Add the three sample wardrobes</Button>
              )}
            </div>
            <p className="type-ledger text-[11px] text-text-2 mt-4">
              Samples are three worked closets — a full year of wear, saved looks, and a shared rail
              between them. Useful for seeing the populated screens before cataloguing your own.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
