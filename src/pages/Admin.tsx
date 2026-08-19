import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Field,
  Masthead,
  Modal,
  SectionTitle,
  Stat,
  TableRail,
  inputClass,
  selectClass,
} from '../components/ui';
import { Basting } from '../components/art';
import { ACCOUNTS_KEY, SESSION_KEY, wardrobeKey } from '../lib/accounts';
import {
  BUDGET_BYTES,
  announceStorage,
  appendLog,
  cleanOrphans,
  clearCloset,
  clearLog,
  deleteAccounts,
  deleteAllAccounts,
  formatBytes,
  listPieces,
  readLedger,
  readLog,
  removePiece,
  removePieceImage,
  runSmokeChecks,
  type AccountLedger,
  type AdminLogEntry,
  type DeviceLedger,
  type OrphanRef,
  type SmokeCheck,
} from '../lib/admin';

/**
 * THE PROJECT LEAD PORTAL — the alpha's control room.
 *
 * Fifteen to twenty people are about to carry this app on their own devices,
 * and someone has to be able to answer "what is on this one" and act on the
 * answer. Everything here reads and changes only what this browser holds —
 * the account, other devices and every remote copy are left alone, and the
 * copy says so wherever something can be destroyed.
 *
 * The law of the page: no destructive action without its own warning, and the
 * warning names what is lost. There are no single-click deletes.
 */

const ADMIN_PASSCODE = 'almari-lead';
const NUKE_PHRASE = 'DELETE EVERYTHING';
const GATE_KEY = 'toile-admin-gate';

function gateOpen(): boolean {
  try {
    return window.sessionStorage.getItem(GATE_KEY) === 'open';
  } catch {
    return false;
  }
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState(gateOpen);
  if (!unlocked) return <Gate onOpen={() => setUnlocked(true)} />;
  return <Portal />;
}

/* ---------- the gate ---------- */

function Gate({ onOpen }: { onOpen: () => void }) {
  const [draft, setDraft] = useState('');
  const [refused, setRefused] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim() === ADMIN_PASSCODE) {
      try {
        window.sessionStorage.setItem(GATE_KEY, 'open');
      } catch {
        /* private mode — the gate simply asks again next visit */
      }
      onOpen();
    } else {
      setRefused(true);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Masthead title="Project lead portal" meta="this device only" />
      <Card>
        <p className="type-editorial text-[20px] leading-snug text-balance">
          A courtesy lock, not a wall.
        </p>
        <p className="text-[14px] text-text-2 leading-relaxed mt-2">
          This passcode keeps a curious shoulder out of the alpha's controls, and that is all it
          is. It is not security and pretends to be nothing more: everything behind it reads and
          changes only what is stored on this device.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4 max-w-[420px]">
          <Field label="Passcode" htmlFor="admin-pass">
            <input
              id="admin-pass"
              type="password"
              className={inputClass}
              value={draft}
              onChange={e => {
                setDraft(e.target.value);
                setRefused(false);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          {refused ? (
            <p className="type-ledger text-[11px] text-danger">That is not the passcode.</p>
          ) : null}
          <Button type="submit" tone="primary" disabled={!draft.trim()}>
            Open the portal
          </Button>
        </form>
      </Card>
    </div>
  );
}

/* ---------- shared bits ---------- */

/** What one destructive step is waiting on its warning. */
type Pending =
  | { kind: 'delete-selected' }
  | { kind: 'delete-all' }
  | { kind: 'remove-image'; accountId: string; accountName: string; itemId: string; name: string }
  | { kind: 'remove-piece'; accountId: string; accountName: string; itemId: string; name: string }
  | { kind: 'clear-closet'; accountId: string; accountName: string; count: number }
  | { kind: 'clean-orphans' }
  | { kind: 'clear-log' }
  | null;

/** '2026-08-19T14:02:…' → '19 Aug, 14:02'. */
function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** One line in the sync column: the mode, then how it stands. */
function syncCell(ledger: AccountLedger): string {
  if (ledger.account.isSample) return 'never — a sample';
  if (ledger.syncMode === 'device') return 'this device only';
  if (ledger.queued) return 'cloud · a push is parked';
  if (ledger.lastSynced) return `cloud · in step ${stamp(ledger.lastSynced)}`;
  return 'cloud · not yet synced';
}

/**
 * The one confirm sheet every destructive action passes through. When
 * `requirePhrase` is set, the confirm stays shut until the phrase is typed.
 */
function Confirm({
  title,
  body,
  confirmLabel,
  requirePhrase,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  requirePhrase?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [phrase, setPhrase] = useState('');
  const armed = !requirePhrase || phrase.trim() === requirePhrase;
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-4 text-[14px] text-text-2 leading-relaxed">{body}</div>
      {requirePhrase ? (
        <div className="mt-4">
          <Field label={`Type ${requirePhrase} to proceed`} htmlFor="admin-confirm-phrase">
            <input
              id="admin-confirm-phrase"
              className={inputClass}
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
      ) : null}
      {/* Cancel is first in the tab order: the Modal autofocuses its first
          control, and the first control on a destructive sheet must not be the
          one that cannot be undone. */}
      <div className="flex flex-wrap gap-2 mt-5">
        <Button onClick={onClose}>Keep everything</Button>
        <Button tone="destructive" disabled={!armed} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ---------- the portal ---------- */

function Portal() {
  const navigate = useNavigate();
  const [ledger, setLedger] = useState<DeviceLedger>(() => readLedger());
  const [log, setLog] = useState<AdminLogEntry[]>(() => readLog());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [contentId, setContentId] = useState<string>(() => {
    const first = readLedger();
    return first.activeId ?? first.accounts[0]?.account.id ?? '';
  });
  const [checks, setChecks] = useState<SmokeCheck[] | null>(null);
  const [orphans, setOrphans] = useState<OrphanRef[]>([]);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  /** Every number on the page re-reads storage; no reload is ever needed. */
  const refresh = () => {
    const next = readLedger();
    setLedger(next);
    setLog(readLog());
    setSelected(prev => new Set([...prev].filter(id => next.accounts.some(l => l.account.id === id))));
    if (!next.accounts.some(l => l.account.id === contentId)) {
      setContentId(next.activeId ?? next.accounts[0]?.account.id ?? '');
    }
  };

  // The closet browser re-reads whenever the picked account or the ledger moves.
  const pieces = useMemo(
    () => listPieces(contentId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentId, ledger]
  );

  const contentAccount = ledger.accounts.find(l => l.account.id === contentId) ?? null;
  const withImages = pieces.filter(p => p.hasImage).length;

  const toggleMarked = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** After surgery inside one wardrobe's store, its open provider re-reads. */
  const afterWardrobeSurgery = (accountId: string) => {
    announceStorage([wardrobeKey(accountId)]);
    refresh();
  };

  const runChecks = async () => {
    setRunning(true);
    try {
      const result = await runSmokeChecks();
      setChecks(result.checks);
      setOrphans(result.orphans);
    } finally {
      setRunning(false);
    }
  };

  /* ---------- the destructive steps, each behind its warning ---------- */

  const confirmRemoveImage = () => {
    if (pending?.kind !== 'remove-image') return;
    const { accountId, accountName, itemId } = pending;
    const name = removePieceImage(accountId, itemId);
    if (name) appendLog('Removed a photograph', `${name} — ${accountName}`);
    setPending(null);
    afterWardrobeSurgery(accountId);
  };

  const confirmRemovePiece = () => {
    if (pending?.kind !== 'remove-piece') return;
    const { accountId, accountName, itemId } = pending;
    const name = removePiece(accountId, itemId);
    if (name) appendLog('Removed a piece', `${name} — ${accountName}`);
    setPending(null);
    afterWardrobeSurgery(accountId);
  };

  const confirmClearCloset = () => {
    if (pending?.kind !== 'clear-closet') return;
    const { accountId, accountName } = pending;
    const count = clearCloset(accountId);
    appendLog('Cleared a closet', `${accountName} — ${count} pieces removed`);
    setPending(null);
    afterWardrobeSurgery(accountId);
  };

  const confirmDeleteSelected = () => {
    const ids = [...selected];
    setPending(null);
    if (ids.length === 0) return;
    const { removed, activeRemoved } = deleteAccounts(ids);
    appendLog(
      removed.length === 1 ? 'Deleted a profile' : 'Deleted profiles',
      removed.map(a => a.name).join(' · ')
    );
    setSelected(new Set());
    if (activeRemoved) {
      // The open wardrobe is gone: the session folds back to the door.
      announceStorage([ACCOUNTS_KEY, SESSION_KEY]);
      navigate('/open', { replace: true });
      return;
    }
    announceStorage([ACCOUNTS_KEY]);
    refresh();
  };

  const confirmDeleteAll = () => {
    const { removed } = deleteAllAccounts();
    appendLog('Deleted every profile', `${removed.length} wardrobes and every trace on this device`);
    setPending(null);
    announceStorage([ACCOUNTS_KEY, SESSION_KEY]);
    navigate('/open', { replace: true });
  };

  const confirmCleanOrphans = () => {
    const cleared = cleanOrphans(orphans);
    const affected = [...new Set(orphans.map(o => o.accountId))];
    appendLog('Cleaned orphan references', `${cleared} image references cleared`);
    setPending(null);
    announceStorage(affected.map(wardrobeKey));
    refresh();
    void runChecks();
  };

  const confirmClearLog = () => {
    clearLog();
    appendLog('Cleared the action log', 'the portal itself');
    setPending(null);
    refresh();
  };

  const marked = ledger.accounts.filter(l => selected.has(l.account.id));
  const markedActive = marked.some(l => l.account.id === ledger.activeId);
  const overBudget = ledger.totalBytes > BUDGET_BYTES;
  const budgetPct = Math.min(100, Math.round((ledger.totalBytes / BUDGET_BYTES) * 100));

  return (
    <div className="space-y-6 max-w-3xl">
      <Masthead title="Project lead portal" meta="this device only" />
      <p className="type-editorial text-[20px] leading-snug text-balance -mt-2">
        The alpha's control room. Everything here reads — and changes — only what this
        browser holds.
      </p>

      {/* ---------- dashboard ---------- */}
      <Card>
        <SectionTitle aside={`${ledger.accounts.length} wardrobes`}>On this device</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
          <Stat value={ledger.ownCount} label="Wardrobes started here" />
          <Stat value={ledger.sampleCount} label="Sample wardrobes" />
          <Stat value={ledger.totalPieces} label="Pieces on record" />
          <Stat value={ledger.totalOutfits} label="Saved outfits" />
          <Stat value={ledger.totalImages} label="Photographs, stored or referenced" />
          <Stat value={formatBytes(ledger.totalBytes)} label={`Of about ${formatBytes(BUDGET_BYTES)} in storage`} />
        </div>
      </Card>

      {/* ---------- accounts and profiles ---------- */}
      <Card>
        <SectionTitle aside={`${selected.size} marked`}>Accounts and profiles</SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Every wardrobe this browser holds. Deleting removes the profile and every key that
          belongs to it — the store, the stamps, any parked sync. A wardrobe marked for sync
          keeps its copy on the account; this portal administers the device only.
        </p>

        {ledger.accounts.length === 0 ? (
          <p className="text-[14px] text-text-2 mt-4">No wardrobes on this device.</p>
        ) : (
          <TableRail label="Accounts on this device" className="mt-4">
            <table className="w-full text-left tabular">
              <thead>
                <tr>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 rule-double w-11">
                    <span className="sr-only">Mark</span>
                  </th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 rule-double">Wardrobe</th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double w-14">Pieces</th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double w-14">Outfits</th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double w-14">Photos</th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double w-20">Size</th>
                  <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 rule-double w-40">Sync</th>
                </tr>
              </thead>
              <tbody>
                {ledger.accounts.map(l => (
                  <tr key={l.account.id} className="border-t border-border">
                    <td className="py-0.5">
                      <label className="inline-flex w-11 h-11 items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          style={{ accentColor: 'var(--color-accent)' }}
                          checked={selected.has(l.account.id)}
                          onChange={() => toggleMarked(l.account.id)}
                          aria-label={`Mark ${l.account.name}`}
                        />
                      </label>
                    </td>
                    <td className="pl-3 py-2 min-w-0">
                      <p className="text-[14px] text-text leading-tight truncate">{l.account.name}</p>
                      <p className="type-ledger text-[10px] text-text-2 mt-0.5">
                        {l.account.isSample ? 'sample' : 'started here'}
                        {l.account.id === ledger.activeId ? ' · open now' : ''}
                        {l.present ? '' : ' · store missing'}
                      </p>
                    </td>
                    <td className="pl-3 py-2 text-right text-[13px] text-text">{l.pieces}</td>
                    <td className="pl-3 py-2 text-right text-[13px] text-text">{l.outfits}</td>
                    <td className="pl-3 py-2 text-right text-[13px] text-text">{l.images}</td>
                    <td className="pl-3 py-2 text-right text-[13px] text-text whitespace-nowrap">{formatBytes(l.bytes)}</td>
                    <td className="pl-3 py-2 text-[12px] text-text-2">{syncCell(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRail>
        )}

        <Basting className="my-4" />

        <div className="flex flex-wrap gap-2">
          <Button
            tone="destructive"
            disabled={selected.size === 0}
            onClick={() => setPending({ kind: 'delete-selected' })}
          >
            Delete selected
          </Button>
          <Button
            tone="destructive"
            disabled={ledger.accounts.length === 0}
            onClick={() => setPending({ kind: 'delete-all' })}
          >
            Delete ALL profiles
          </Button>
        </div>
      </Card>

      {/* ---------- the closets ---------- */}
      <Card>
        <SectionTitle aside={contentAccount ? `${pieces.length} pieces` : undefined}>The closets</SectionTitle>
        {ledger.accounts.length === 0 ? (
          <p className="text-[14px] text-text-2">No wardrobes on this device.</p>
        ) : (
          <>
            <div className="max-w-[420px]">
              <Field label="Whose closet" htmlFor="admin-closet">
                <select
                  id="admin-closet"
                  className={selectClass}
                  value={contentId}
                  onChange={e => setContentId(e.target.value)}
                >
                  {ledger.accounts.map(l => (
                    <option key={l.account.id} value={l.account.id}>
                      {l.account.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <p className="type-ledger text-[11px] text-text-2">
                {pieces.length} pieces · {withImages} with a photograph
              </p>
              <Button
                tone="destructive"
                compact
                disabled={pieces.length === 0 || !contentAccount}
                onClick={() =>
                  contentAccount &&
                  setPending({
                    kind: 'clear-closet',
                    accountId: contentAccount.account.id,
                    accountName: contentAccount.account.name,
                    count: pieces.length,
                  })
                }
              >
                Clear this closet
              </Button>
            </div>

            {pieces.length === 0 ? (
              <p className="text-[14px] text-text-2 mt-3">This closet is empty.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {pieces.map(p => (
                  <li key={p.id} className="py-2 flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-0 basis-40">
                      <p className="text-[14px] text-text leading-tight truncate">{p.name}</p>
                      <p className="type-ledger text-[10px] text-text-2 mt-0.5">
                        {p.categoryLabel}
                        {p.retired ? ' · retired' : ''}
                        {p.hasImage ? ' · has a photograph' : ' · no photograph'}
                      </p>
                    </div>
                    <Button
                      compact
                      disabled={!p.hasImage || !contentAccount}
                      onClick={() =>
                        contentAccount &&
                        setPending({
                          kind: 'remove-image',
                          accountId: contentAccount.account.id,
                          accountName: contentAccount.account.name,
                          itemId: p.id,
                          name: p.name,
                        })
                      }
                    >
                      Remove image
                    </Button>
                    <Button
                      compact
                      disabled={!contentAccount}
                      onClick={() =>
                        contentAccount &&
                        setPending({
                          kind: 'remove-piece',
                          accountId: contentAccount.account.id,
                          accountName: contentAccount.account.name,
                          itemId: p.id,
                          name: p.name,
                        })
                      }
                    >
                      Remove piece
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      {/* ---------- the smoke checks ---------- */}
      <Card>
        <SectionTitle
          aside={checks ? `${checks.filter(c => c.pass).length} of ${checks.length} passing` : 'not run yet'}
        >
          Smoke checks
        </SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          In-browser checks over what this device holds. Nothing leaves the browser for them —
          an image reference is only asked whether its file answers.
        </p>
        <div className="mt-4">
          <Button tone="primary" onClick={() => { void runChecks(); }} disabled={running}>
            {running ? 'Running the checks' : checks ? 'Run the checks again' : 'Run the checks'}
          </Button>
        </div>

        {checks ? (
          <ul className="mt-5 space-y-4">
            {checks.map(c => (
              <li key={c.id}>
                <div className="flex items-baseline gap-3">
                  <span
                    className={`type-ledger text-[11px] w-10 shrink-0 ${c.pass ? 'text-success' : 'text-danger'}`}
                  >
                    {c.pass ? 'Pass' : 'Fail'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] text-text leading-tight">{c.label}</p>
                    <p className="text-[13px] text-text-2 leading-snug mt-0.5">{c.detail}</p>
                  </div>
                </div>
                {c.id === 'budget' ? (
                  <div className="mt-2 ml-[52px]">
                    <div
                      className="h-2 bg-sunken rounded-[2px] overflow-hidden"
                      role="img"
                      aria-label={`About ${budgetPct}% of the storage budget`}
                    >
                      <div
                        className={`h-full ${overBudget ? 'bg-danger-fill' : 'bg-accent'}`}
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {c.id === 'orphans' && orphans.length > 0 ? (
                  <div className="mt-2 ml-[52px]">
                    <Button compact onClick={() => setPending({ kind: 'clean-orphans' })}>
                      Clean orphans
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* ---------- the action log ---------- */}
      <Card>
        <SectionTitle aside={`${log.length} entries`}>What the portal has done</SectionTitle>
        {log.length === 0 ? (
          <p className="text-[14px] text-text-2">
            Nothing yet. Every destructive action lands here, newest first.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {log.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="py-2 flex flex-wrap items-baseline gap-x-3">
                  <span className="type-ledger text-[11px] text-text-2 tabular shrink-0">
                    {stamp(entry.at)}
                  </span>
                  <span className="text-[14px] text-text">{entry.action}</span>
                  <span className="text-[13px] text-text-2 min-w-0 flex-1">{entry.target}</span>
                </li>
              ))}
            </ul>
            <Basting className="my-4" />
            <Button onClick={() => setPending({ kind: 'clear-log' })}>Clear log</Button>
          </>
        )}
      </Card>

      {/* ---------- the warnings: one per destructive step ---------- */}

      {pending?.kind === 'delete-selected' ? (
        <Confirm
          title={marked.length === 1 ? 'Delete this profile?' : `Delete these ${marked.length} profiles?`}
          body={
            <>
              <p>
                {marked.length === 1
                  ? 'This profile and every key belonging to it leave this browser:'
                  : 'These profiles and every key belonging to them leave this browser:'}
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {marked.map(l => (
                  <li key={l.account.id}>
                    {l.account.name} — {l.pieces} pieces, {l.outfits} outfits
                  </li>
                ))}
              </ul>
              <p>
                {markedActive
                  ? 'The open wardrobe is among them; you will land at the door. '
                  : ''}
                A synced wardrobe keeps its copy on the account. There is no undo.
              </p>
            </>
          }
          confirmLabel={marked.length === 1 ? 'Delete it' : `Delete ${marked.length} profiles`}
          onConfirm={confirmDeleteSelected}
          onClose={() => setPending(null)}
        />
      ) : null}

      {pending?.kind === 'delete-all' ? (
        <Confirm
          title="Delete every profile on this device?"
          body={
            <>
              <p>
                Every profile — {ledger.ownCount} started here and {ledger.sampleCount} samples —
                goes, with every piece, outfit, wear log and photograph filed under it, and this
                browser returns to the door.
              </p>
              <p>
                Copies kept on the account, where any exist, are not touched. There is no undo.
              </p>
            </>
          }
          confirmLabel="Delete everything"
          requirePhrase={NUKE_PHRASE}
          onConfirm={confirmDeleteAll}
          onClose={() => setPending(null)}
        />
      ) : null}

      {pending?.kind === 'remove-image' ? (
        <Confirm
          title="Remove this photograph?"
          body={
            <p>
              The photograph comes off "{pending.name}" in {pending.accountName}'s closet. The
              piece, its history and every wear stay. There is no undo.
            </p>
          }
          confirmLabel="Remove the image"
          onConfirm={confirmRemoveImage}
          onClose={() => setPending(null)}
        />
      ) : null}

      {pending?.kind === 'remove-piece' ? (
        <Confirm
          title="Remove this piece?"
          body={
            <p>
              "{pending.name}" leaves {pending.accountName}'s closet, and every wear logged
              against it goes with it. Outfits naming it lose it. There is no undo.
            </p>
          }
          confirmLabel="Remove the piece"
          onConfirm={confirmRemovePiece}
          onClose={() => setPending(null)}
        />
      ) : null}

      {pending?.kind === 'clear-closet' ? (
        <Confirm
          title="Clear this closet?"
          body={
            <p>
              Every one of the {pending.count} pieces in {pending.accountName}'s closet is
              removed, with their wear logs. Categories, occasion tags and furniture stay. There
              is no undo.
            </p>
          }
          confirmLabel="Clear the closet"
          onConfirm={confirmClearCloset}
          onClose={() => setPending(null)}
        />
      ) : null}

      {pending?.kind === 'clean-orphans' ? (
        <Confirm
          title="Clean the orphan references?"
          body={
            <p>
              {orphans.length} image {orphans.length === 1 ? 'reference points' : 'references point'} at
              files that are no longer there. Cleaning clears the reference from the piece, outfit
              or wish; everything else about it stays. There is no undo.
            </p>
          }
          confirmLabel="Clean them"
          onConfirm={confirmCleanOrphans}
          onClose={() => setPending(null)}
        />
      ) : null}

      {pending?.kind === 'clear-log' ? (
        <Confirm
          title="Clear the action log?"
          body={
            <p>
              The record of what the portal has done is emptied. The actions it records are not
              undone — only the record goes.
            </p>
          }
          confirmLabel="Clear the log"
          onConfirm={confirmClearLog}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}
