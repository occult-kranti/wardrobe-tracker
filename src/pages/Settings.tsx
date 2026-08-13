import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { soundOn, setSound, chime } from '../lib/sound';
import { useWardrobe } from '../context/WardrobeContext';
import { useSession } from '../context/SessionContext';
import { SCHEMA_VERSION, displayTag, initialState, type AppState, type Theme } from '../types';
import { daysSince, formatLocalDate, todayLocal } from '../lib/dates';
import { THEME_ORDER } from '../lib/accounts';
import { migrate } from '../lib/migrate';
import { buildDemoState, DEMO_SUMMARY } from '../lib/demoData';
import {
  Button,
  Card,
  Chip,
  Field,
  IconButton,
  Masthead,
  SectionTitle,
  inputClass, LinkButton } from '../components/ui';
import { Basting } from '../components/art';
import {
  IconClose,
  IconDown,
  IconExport,
  IconEyelet,
  IconEyeletFilled,
  IconImport,
  IconUp,
} from '../components/icons';
import { showToast } from '../components/Toast';
import { useInstall } from '../lib/install';
import { hasKey, keyLooksWrong, loadKey, saveKey } from '../lib/anthropic';

/**
 * SETTINGS — stewardship, not preferences.
 *
 * Three contracts meet here (docs/06-focus-group-requirements.md §1 rows 1 and 9):
 *
 *  1. Own your taxonomy. Categories are the user's data — rename, add, reorder,
 *     and mark any of them quiet. Six fixed boxes erase everyone who dresses
 *     outside them. Occasions are free-form lowercase tags.
 *  2. Export the WHOLE state, generically. The old export hand-picked three keys
 *     and silently dropped the wishlist; anything added later would have been
 *     dropped too. It now serializes every data field the context holds, and
 *     import runs the file through migrate() so unknown fields round-trip intact.
 *  3. Say plainly where the data lives. The backup reminder is a quiet inline
 *     card that can be dismissed — never a notification, never blocking.
 *
 * Destructive flows are plain, inline, and state exactly what is lost. No native
 * confirm() dialogs, no accounts, no telemetry, no commerce.
 */

/* ---------- local helpers (not in the shared primitives) ---------- */

/** Derived values on the context that must never be written into a backup. */
const DERIVED_KEYS = new Set(['activeItems']);

/**
 * Everything on the context that is data rather than behaviour. Generic on
 * purpose: a field added to AppState tomorrow lands in the export by itself.
 */
function serializableState(ctx: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(ctx).filter(([key, value]) => typeof value !== 'function' && !DERIVED_KEYS.has(key))
  );
}

/** Whole days since an ISO timestamp, in local time. Null if it won't parse. */
function daysSinceISO(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return daysSince(formatLocalDate(d));
}

/** '2026-08-10T…' → '10 Aug 2026'. */
function longDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A 44px pressed-state toggle: the Chip's eyelet at a real touch size. */
function Toggle({
  active,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`h-11 px-3 type-label inline-flex items-center justify-center gap-2 rounded-[2px] border transition-colors duration-150 ${
        active
          ? 'bg-ink text-on-ink border-transparent'
          : 'border-border text-text-2 hover:text-text hover:bg-sunken'
      } ${className}`}
      {...rest}
    >
      {/* Stated against the ink fill, not against paper — see the Chip in ui.tsx. */}
      <span className={active ? 'text-accent-on-ink' : 'opacity-60'}>
        {active ? <IconEyeletFilled size={10} /> : <IconEyelet size={10} />}
      </span>
      {children}
    </button>
  );
}

/** A settings row: label and explanation at left, the control at right. */
function Row({
  title,
  body,
  control,
}: {
  title: string;
  body: string;
  control: ReactNode;
}) {
  // Stacks below `sm`. The control side must be able to shrink (`min-w-0`,
  // never `shrink-0`): a shrink-proof control as wide as seven theme chips
  // means its flex-wrap can never engage, and the text column pays for it —
  // one word per line, fifteen hundred pixels tall.
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 py-1">
      <div className="min-w-0 sm:max-w-[52ch]">
        <p className="text-[15px] text-text leading-tight">{title}</p>
        <p className="text-[13px] text-text-2 leading-snug mt-1">{body}</p>
      </div>
      <div className="sm:min-w-0">{control}</div>
    </div>
  );
}

/**
 * Installing the app.
 *
 * Every rival is in both app stores; this is a web page. What a person
 * actually wants from that is the icon on their home screen, opening without
 * browser furniture, working on a plane — and a manifest and a service worker
 * give all three without a company, a store account, or a server.
 *
 * Three honest states: already installed, ready to install, and browsers with
 * no install prompt at all (Safari), where the truthful answer is the two-line
 * instruction rather than a button that does nothing.
 */
function InstallRow() {
  const { ready, installed, install } = useInstall();

  if (installed) {
    return (
      <Row
        title="Installed"
        body="Almari is on your home screen and opens without browser chrome. It works with no signal, because the wardrobe was never anywhere else."
        control={<span className="type-ledger text-[11px] text-text-2">On this device</span>}
      />
    );
  }

  return (
    <Row
      title="Add Almari to your home screen"
      body={
        ready
          ? 'It gets an icon, opens full screen, and works offline. No store, no account, no download — the page you already have simply stays.'
          : 'Your browser installs from its own menu: Share, then "Add to Home Screen" on iPhone; the menu, then "Install app" on Android and desktop Chrome. It gets an icon, opens full screen, and works offline.'
      }
      control={
        ready ? (
          <Button tone="primary" onClick={() => { void install(); }}>Add to home screen</Button>
        ) : (
          <span className="type-ledger text-[11px] text-text-2">From your browser menu</span>
        )
      }
    />
  );
}

/**
 * The key, and the one honest sentence about what it is for.
 *
 * This is the only place in the app where a network call is possible at all,
 * so the row says so at full weight rather than in a hint. Nothing is sent
 * because a key exists — only when a photograph is handed over on purpose.
 */
function KeyRow() {
  const [key, setKey] = useState(() => loadKey());
  const [held, setHeld] = useState(() => hasKey());

  return (
    <div className="space-y-3">
      <Row
        title="Your Anthropic key"
        body={
          held
            ? 'Held on this device, and used only when you hand over a photograph on the intake bench. It is never sent anywhere but Anthropic, and only with a photograph you chose.'
            : 'Optional. With a key, Almari can read a photograph for you on the bench. Without one, copy the prompt into the model you already use — the bench works either way.'
        }
        control={
          held ? (
            <Button
              onClick={() => { saveKey(''); setKey(''); setHeld(false); showToast('Key removed from this device.', 'info'); }}
            >
              Remove it
            </Button>
          ) : null
        }
      />
      {held ? null : (
        <div className="max-w-[420px]">
          <Field label="Key" htmlFor="set-key" hint="Stored in this browser only. Keys begin with sk-ant-.">
            <input
              id="set-key"
              type="password"
              className={inputClass}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Button
              disabled={!key.trim() || keyLooksWrong(key)}
              onClick={() => { saveKey(key); setHeld(true); showToast('Key kept on this device.', 'success'); }}
            >
              Keep the key
            </Button>
            {keyLooksWrong(key) ? (
              <span className="type-ledger text-[10px] text-danger">Keys begin with sk-ant-</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The rooms, named — but NOT ordered here.
 *
 * This list used to carry its own order, and it disagreed with the one the
 * theme button cycles through: the picker opened on the pattern room while the
 * button went to the dye house first. Two orders for one set of rooms is a bug
 * that cannot be fixed by sorting one of them, because the next person to add a
 * room will put it in whichever list they happen to be editing. So the ORDER
 * has exactly one declaration — THEME_ORDER, in lib/accounts.ts, which is also
 * what nextTheme() walks — and this file supplies only the words.
 *
 * Record<Theme, string> is doing real work: add a room to the union in types.ts
 * and this stops compiling until it has a name.
 */
const THEME_LABELS: Record<Theme, string> = {
  dyehouse: 'Dye house',
  obsidian: 'Obsidian',
  dark: 'Atelier',
  salon: 'Salon',
  gilt: 'Gilding room',
  light: 'Pattern room',
  system: 'System',
};

const THEMES: { value: Theme; label: string }[] =
  THEME_ORDER.map(value => ({ value, label: THEME_LABELS[value] }));

/* ---------- the page ---------- */

export default function Settings() {
  const wardrobe = useWardrobe();
  const {
    items,
    outfits,
    wearLogs,
    wishlist,
    settings,
    addCategory,
    renameCategory,
    setCategoryQuiet,
    moveCategory,
    addOccasion,
    replaceState,
    markExported,
  } = wardrobe;

  const [pending, setPending] = useState<{ state: AppState; fileName: string } | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundOn());
  const [showDemo, setShowDemo] = useState(false);
  const [reminderOff, setReminderOff] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState('');
  const [newOccasion, setNewOccasion] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { theme, setTheme } = useSession();
  const records = items.length + outfits.length + wearLogs.length + wishlist.length;

  /* ---------- export: the whole state, generically ---------- */

  const handleExport = () => {
    const payload = {
      ...serializableState(wardrobe),
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toile-backup-${todayLocal()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    markExported();
    showToast(`Exported. ${records} records in one file.`, 'success');
  };

  /* ---------- import: parse, migrate, then ask ---------- */

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const input = e.target;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(String(ev.target?.result ?? ''));
        // migrate() carries every older shape forward and keeps unknown fields.
        setPending({ state: migrate(parsed), fileName: file.name });
      } catch {
        showToast('That file did not read as a backup.', 'error');
      }
      // Let the same file be chosen twice in a row.
      input.value = '';
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!pending) return;
    replaceState(pending.state);
    showToast(`Imported. ${pending.state.items.length} pieces on record.`, 'success');
    setPending(null);
  };

  /* ---------- backup reminder: quiet, inline, dismissible ---------- */

  const sinceExport = settings.lastExportAt ? daysSinceISO(settings.lastExportAt) : null;
  const backupStale = sinceExport === null || sinceExport > 30;
  // "Meaningful" = enough on record that losing it would actually cost something.
  const showReminder = !reminderOff && backupStale && records >= 3;

  /* ---------- taxonomy ---------- */

  const commitRename = (id: string, label: string) => {
    const trimmed = label.trim();
    if (trimmed) renameCategory(id, trimmed);
    setDrafts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCategory.trim();
    if (!label) return;
    addCategory(label);
    setNewCategory('');
    showToast(`Added "${label}".`, 'success');
  };

  const handleAddOccasion = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = newOccasion.trim().toLowerCase();
    if (!tag) return;
    addOccasion(tag);
    setNewOccasion('');
  };

  /* ---------- reset ---------- */

  const handleReset = () => {
    replaceState(initialState);
    setShowReset(false);
    showToast('Reset. The closet is empty.', 'info');
  };

  /* ---------- sample wardrobe ---------- */

  const hasRecords = records > 0;

  const handleLoadDemo = () => {
    replaceState(buildDemoState());
    setShowDemo(false);
    showToast(
      `Loaded. ${DEMO_SUMMARY.items} pieces, ${DEMO_SUMMARY.outfits} outfits.`,
      'success'
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Masthead title="Settings" meta={`Schema ${SCHEMA_VERSION}`} />

      {/* ---------- backup reminder ---------- */}
      {showReminder ? (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="type-editorial text-[20px] leading-snug text-balance">
                This closet lives in one browser, on one device.
              </p>
              <p className="text-[14px] text-text-2 leading-relaxed mt-2">
                Almari keeps {records} records in this browser's local storage. There is no
                account and no copy on a server — clearing site data, switching browsers, or
                losing the device takes the history with it. An export is the only copy there is.
              </p>
              <p className="type-ledger text-[11px] text-text-2 tabular mt-3">
                {settings.lastExportAt
                  ? `Last export ${longDay(settings.lastExportAt)} · ${sinceExport} days ago`
                  : 'No export yet'}
              </p>
              <button type="button" onClick={handleExport} className="type-label text-accent underline underline-offset-[3px] decoration-1 hover:decoration-2 mt-3 h-11 inline-flex items-center">
                Export a backup now
              </button>
            </div>
            <IconButton
              label="Dismiss the backup reminder"
              onClick={() => setReminderOff(true)}
              className="-mr-2 -mt-2 shrink-0"
            >
              <IconClose size={16} />
            </IconButton>
          </div>
        </Card>
      ) : null}

      {/* ---------- taxonomy: categories ---------- */}
      <Card>
        <SectionTitle aside={`${settings.categories.length} categories`}>
          Your categories
        </SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          These are yours to name and order. The list here is the order they appear in
          everywhere else — browse, the add form, the ledger.
        </p>

        <Basting className="my-4" />

        <ul className="space-y-3">
          {settings.categories.map((cat, index) => (
            <li key={cat.id}>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <label htmlFor={`cat-${cat.id}`} className="sr-only">
                    Category name
                  </label>
                  <input
                    id={`cat-${cat.id}`}
                    type="text"
                    value={drafts[cat.id] ?? cat.label}
                    onChange={e => setDrafts(prev => ({ ...prev, [cat.id]: e.target.value }))}
                    onBlur={e => commitRename(cat.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>
                <Toggle
                  active={cat.quiet === true}
                  onClick={() => setCategoryQuiet(cat.id, !cat.quiet)}
                  aria-label={`${cat.label}: quiet`}
                  className="shrink-0"
                >
                  Quiet
                </Toggle>
                <IconButton
                  label={`Move ${cat.label} up`}
                  onClick={() => moveCategory(cat.id, -1)}
                  disabled={index === 0}
                  className="shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <IconUp size={16} />
                </IconButton>
                <IconButton
                  label={`Move ${cat.label} down`}
                  onClick={() => moveCategory(cat.id, 1)}
                  disabled={index === settings.categories.length - 1}
                  className="shrink-0 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <IconDown size={16} />
                </IconButton>
              </div>
              {cat.quiet ? (
                <p className="type-ledger text-[10px] text-text-2 mt-1">
                  Hidden from browse and the generator. No photo expected.
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="text-[13px] text-text-2 leading-snug mt-4">
          Quiet is for what you keep but don't style — hidden from browse and the generator,
          no photo expected. Categories can't be removed yet; making one quiet takes it out of
          the way without touching the pieces filed under it.
        </p>

        <Basting className="my-4" />

        <form onSubmit={handleAddCategory} className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <Field label="Add a category" htmlFor="new-category">
              <input
                id="new-category"
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Workwear, costume, hosiery"
                autoComplete="off"
                className={inputClass}
              />
            </Field>
          </div>
          <Button type="submit" disabled={!newCategory.trim()}>
            Add
          </Button>
        </form>
      </Card>

      {/* ---------- taxonomy: occasions ---------- */}
      <Card>
        <SectionTitle aside={`${settings.occasions.length} tags`}>Occasion tags</SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Free-form and lowercase. These are the tags offered when you file a piece or ask
          Before You Buy what it's for.
        </p>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {settings.occasions.map(tag => (
            <Chip key={tag} as="span">
              {displayTag(tag)}
            </Chip>
          ))}
        </div>

        <Basting className="my-4" />

        <form onSubmit={handleAddOccasion} className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <Field label="Add a tag" htmlFor="new-occasion">
              <input
                id="new-occasion"
                type="text"
                value={newOccasion}
                onChange={e => setNewOccasion(e.target.value)}
                placeholder="gig, studio, funeral"
                autoComplete="off"
                className={inputClass}
              />
            </Field>
          </div>
          <Button type="submit" disabled={!newOccasion.trim()}>
            Add
          </Button>
        </form>
      </Card>

      {/* ---------- appearance ---------- */}
      <Card>
        <SectionTitle>Appearance</SectionTitle>
        <Row
          title="Paper"
          body="Six rooms in the same building: the pattern room where cloth is cut, the salon where a collection is shown, the gilding room where the gold leaf is laid, the dye house where the madder vats stain the walls rose, the obsidian where the glass reflects, and the atelier at night. System follows the device. The choice belongs to this screen, not to a wardrobe, so it holds when you open a different one."
          control={
            <div className="flex flex-wrap gap-2">
              {THEMES.map(opt => (
                <Toggle
                  key={opt.value}
                  active={theme === opt.value}
                  onClick={() => setTheme(opt.value)}
                >
                  {opt.label}
                </Toggle>
              ))}
            </div>
          }
        />
        <Row
          title="Sound"
          body="A felt tick when a control is pressed, a small windchime when the record confirms. Synthesized on this device as it plays; nothing is downloaded and nothing listens."
          control={
            <div className="flex flex-wrap gap-2">
              {[true, false].map(on => (
                <Toggle
                  key={String(on)}
                  active={soundEnabled === on}
                  onClick={() => {
                    setSoundEnabled(on);
                    setSound(on);
                    if (on) chime();
                  }}
                >
                  {on ? 'On' : 'Off'}
                </Toggle>
              ))}
            </div>
          }
        />
      </Card>

      {/* ---------- cataloguing from photographs ---------- */}
      <Card>
        <SectionTitle aside="the first hour">Catalogue from photos</SectionTitle>
        <Row
          title="From a photograph"
          body="Photograph what you are wearing, or a whole layout at once. Every piece is found, cut out of the photograph on this device, and arrives as a draft to check."
          control={<LinkButton to="/intake?worn=1">Open the bench</LinkButton>}
        />
        <Basting className="my-4" />
        <KeyRow />
      </Card>

      {/* ---------- on this device ---------- */}
      <Card>
        <SectionTitle aside="no store, no company">On your home screen</SectionTitle>
        <InstallRow />
      </Card>

      {/* ---------- data ---------- */}
      <Card>
        <SectionTitle aside={`${records} records`}>Your data</SectionTitle>

        <div className="space-y-4">
          <Row
            title="Export"
            body="One JSON file holding everything on this device: pieces, outfits, wear logs, the wishlist, your categories and tags."
            control={
              <Button tone="primary" icon={<IconExport size={16} />} onClick={handleExport}>
                Export
              </Button>
            }
          />

          <Basting />

          <Row
            title="Import"
            body="Reads a backup from any version of Almari and brings it forward. Fields it doesn't recognise are kept, not dropped."
            control={
              <>
                <Button icon={<IconImport size={16} />} onClick={() => fileRef.current?.click()}>
                  Choose a file
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={handleFile}
                />
              </>
            }
          />

          {pending ? (
            <div className="bg-sunken rounded-[2px] p-4">
              <p className="type-ledger text-[11px] text-text-2">{pending.fileName}</p>
              <p className="text-[14px] text-text leading-relaxed mt-2">
                That file holds {pending.state.items.length} pieces, {pending.state.outfits.length}{' '}
                outfits, {pending.state.wearLogs.length} wear logs and{' '}
                {pending.state.wishlist.length} wishlist entries. Bringing it in replaces what is
                on this device now.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button onClick={confirmImport}>Bring it in</Button>
                <Button onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </div>
          ) : null}

          <Basting />

          <Row
            title="Sample wardrobe"
            body={`A worked example — ${DEMO_SUMMARY.items} pieces including ${DEMO_SUMMARY.jewellery} pieces of jewellery, ${DEMO_SUMMARY.outfits} saved outfits, a year of wear history, and a wishlist mid-cooling-off. Useful for seeing the populated screens before cataloguing your own.`}
            control={
              <Button onClick={() => setShowDemo(true)}>Load sample</Button>
            }
          />

          {showDemo ? (
            <div className="bg-sunken rounded-[2px] p-4">
              <p className="text-[15px] text-text leading-tight">
                {hasRecords ? 'Replace what is here with the sample?' : 'Load the sample wardrobe?'}
              </p>
              <p className="text-[14px] text-text-2 leading-relaxed mt-2">
                {hasRecords
                  ? `This device currently holds ${records} records. Loading the sample replaces all of them, and there is no copy unless you exported one.`
                  : 'Nothing is on this device yet, so nothing will be lost. Reset from here whenever you want to start your own.'}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button tone={hasRecords ? 'destructive' : 'primary'} onClick={handleLoadDemo}>
                  {hasRecords ? 'Replace with the sample' : 'Load it'}
                </Button>
                <Button onClick={() => setShowDemo(false)}>Cancel</Button>
              </div>
            </div>
          ) : null}

          <Basting />

          <Row
            title="Start over"
            body="Clears this device and returns Almari to its defaults."
            control={
              <Button tone="destructive" onClick={() => setShowReset(true)}>
                Reset
              </Button>
            }
          />

          {showReset ? (
            <div className="bg-sunken rounded-[2px] p-4">
              <p className="text-[15px] text-text leading-tight">Reset everything?</p>
              <p className="text-[14px] text-text-2 leading-relaxed mt-2">
                This clears {items.length} pieces, {outfits.length} outfits, {wearLogs.length} wear
                logs and {wishlist.length} wishlist entries, along with every category and
                occasion tag you have added. It cannot be undone, and there is no copy anywhere
                unless you exported one.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button tone="destructive" onClick={handleReset}>
                  Reset everything
                </Button>
                <Button onClick={() => setShowReset(false)}>Keep it</Button>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* ---------- about ---------- */}
      <Card>
        <SectionTitle>About</SectionTitle>
        <p className="type-masthead text-[24px]">Almari</p>
        <p className="type-editorial text-[16px] text-text-2 mt-1">Your wardrobe, on record.</p>

        <Basting className="my-4" />

        <p className="text-[14px] text-text-2 leading-relaxed">
          Everything you enter stays in this browser's local storage. There are no accounts, no
          sync, no analytics, and nothing is sent anywhere — the app makes no network requests
          about your closet at all. There are no shop links, affiliate codes or sponsored
          pieces, and there never will be. Because the data lives only here, keeping a copy is
          on you.
        </p>

        <button
          type="button"
          onClick={handleExport}
          className="type-label text-accent underline underline-offset-[3px] decoration-1 hover:decoration-2 mt-3 h-11 inline-flex items-center"
        >
          Export a backup
        </button>

        <p className="type-ledger text-[10px] text-text-2 tabular mt-2">
          Schema version {SCHEMA_VERSION}
        </p>
      </Card>
    </div>
  );
}
