import { Button, Card, Chip, SectionTitle, Stat, TableRail } from '../components/ui';
import {
  daysSinceStamp,
  formatBytes,
  formatStamp,
  rosterFunnel,
  shortId,
  type AlphaStatsResult,
  type ProbeResult,
  type RelayService,
} from './lib/statsClient';

/**
 * THE BOARD'S PANELS.
 *
 * One rule governs every one of them: a number appears only when a service
 * answered with it. There is no zero standing in for "not asked", no dash
 * standing in for "refused", and no skeleton implying an answer is on its way
 * when nothing was ever requested. Each state gets its own sentence, because
 * "we asked and the answer is none" and "we never asked" are different facts
 * and a project lead will act differently on each.
 */

/* ---------- the shared way of saying nothing is known ---------- */

function Quiet({ children }: { children: string }) {
  return <p className="text-[14px] text-text-2 leading-relaxed">{children}</p>;
}

/** The one place the four non-ok states are worded, so they cannot drift. */
function statsTrouble(result: AlphaStatsResult | null, loading: boolean): string | null {
  if (loading) return 'Asking the stats service.';
  if (result === null) return 'Not asked yet. Give a token and press Read the board.';
  if (result.kind === 'refused') return 'The token was refused. Nothing was read.';
  if (result.kind === 'absent') {
    return 'The stats service did not answer. It may not be deployed yet, or this machine cannot reach it.';
  }
  if (result.kind === 'failed') return `The service answered ${result.status}, not numbers.`;
  return null;
}

/* ---------- the count ---------- */

export function AlphaCount({
  result,
  loading,
}: {
  result: AlphaStatsResult | null;
  loading: boolean;
}) {
  const trouble = statsTrouble(result, loading);
  return (
    <Card>
      <SectionTitle aside="the stats service">The count</SectionTitle>
      {trouble ? (
        <Quiet>{trouble}</Quiet>
      ) : result && result.kind === 'ok' ? (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          <Stat value={result.stats.users} label="Accounts" />
          <Stat value={result.stats.profiles} label="Profiles" />
          <Stat value={result.stats.wardrobes.length} label="Wardrobes synced" />
        </div>
      ) : null}
    </Card>
  );
}

/* ---------- the synced wardrobes ---------- */

export function WardrobeRows({
  result,
  loading,
}: {
  result: AlphaStatsResult | null;
  loading: boolean;
}) {
  const trouble = statsTrouble(result, loading);
  const rows =
    result && result.kind === 'ok'
      ? [...result.stats.wardrobes].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
      : [];

  const owners = new Set(rows.map(r => r.user_id)).size;
  const stored = rows.reduce((sum, r) => sum + (typeof r.bytes === 'number' ? r.bytes : 0), 0);
  const latest = rows.length ? rows[0].updated_at : '';

  return (
    <Card>
      <SectionTitle aside="the stats service">The synced wardrobes</SectionTitle>

      {trouble ? (
        <Quiet>{trouble}</Quiet>
      ) : rows.length === 0 ? (
        <Quiet>No wardrobe has been synced. The service answered; the table is genuinely empty.</Quiet>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-x-4 gap-y-6 mb-5">
            <Stat value={owners} label="Owners with a wardrobe" />
            <Stat value={formatBytes(stored)} label="Total stored" />
            <Stat value={formatStamp(latest)} label="Most recent sync" />
          </div>
          <TableRail label="Synced wardrobes">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="type-ledger text-[11px] text-text-2">
                  <th className="font-normal py-2 pr-4">wardrobe</th>
                  <th className="font-normal py-2 pr-4">owner</th>
                  <th className="font-normal py-2 pr-4">last synced</th>
                  <th className="font-normal py-2 pr-4">size</th>
                  <th className="font-normal py-2">envelope</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="font-mono text-[13px] py-2 pr-4">{shortId(r.id)}</td>
                    <td className="font-mono text-[13px] py-2 pr-4 text-text-2">{shortId(r.user_id)}</td>
                    <td className="text-[13px] py-2 pr-4 tabular">{formatStamp(r.updated_at)}</td>
                    <td className="text-[13px] py-2 pr-4 tabular">{formatBytes(r.bytes ?? 0)}</td>
                    <td className="font-mono text-[13px] py-2 text-text-2">
                      {r.v === null || r.v === undefined ? 'bare' : `v${r.v}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRail>
          <p className="text-[13px] text-text-2 leading-relaxed mt-4">
            The wardrobe document itself is never returned — the service measures it and reports the
            size, and the record stays between its owner and the table.
          </p>
        </>
      )}
    </Card>
  );
}

/* ---------- who has arrived ---------- */

export function Roster({
  result,
  loading,
}: {
  result: AlphaStatsResult | null;
  loading: boolean;
}) {
  const trouble = statsTrouble(result, loading);
  const stats = result && result.kind === 'ok' ? result.stats : null;

  /* A SERVICE OLDER THAN THIS BOARD IS NOT AN EMPTY ALPHA.
     Both render as a table with no rows, and they mean opposite things: one is
     "nobody has signed up", the other is "this board asked a question the
     deployed function does not answer". Telling the owner the first when the
     second is true is the exact failure this board was rebuilt to stop. */
  const serviceIsOlder = stats !== null && !stats.hasRoster;

  const roster = stats?.roster ?? [];
  const funnel = rosterFunnel(roster);

  return (
    <Card>
      <SectionTitle aside="the stats service">Who has arrived</SectionTitle>

      {trouble ? (
        <Quiet>{trouble}</Quiet>
      ) : serviceIsOlder ? (
        <Quiet>
          The stats service answered, but it sent no roster. It was deployed before this board asked
          for one — redeploy admin-stats and the table appears. This is not an empty alpha.
        </Quiet>
      ) : roster.length === 0 ? (
        <Quiet>
          Nobody has made an account yet. The service answered; the roster is genuinely empty.
        </Quiet>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6 mb-5">
            <Stat value={funnel.arrived} label="Made an account" />
            <Stat value={funnel.settled} label="Then made a profile" />
            <Stat value={funnel.kept} label="Then synced a wardrobe" />
            <Stat value={funnel.returned} label="Came back at least once" />
          </div>

          <p className="text-[13px] text-text-2 leading-relaxed mb-4">
            Counts, not rates. With {funnel.arrived}{' '}
            {funnel.arrived === 1 ? 'person' : 'people'} on the roster, one of them is worth{' '}
            {(100 / funnel.arrived).toFixed(0)} points, so a percentage here would invite a
            conclusion this many people cannot support.
            {funnel.unconfirmed > 0 ? (
              <>
                {' '}
                {funnel.unconfirmed}{' '}
                {funnel.unconfirmed === 1 ? 'address has' : 'addresses have'} not been confirmed —
                an invitation that arrived and was never opened looks like this.
              </>
            ) : null}
          </p>

          <TableRail label="Everyone who has made an account">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="type-ledger text-[11px] text-text-2">
                  <th className="font-normal py-2 pr-4">who</th>
                  <th className="font-normal py-2 pr-4">joined</th>
                  <th className="font-normal py-2 pr-4">last seen</th>
                  <th className="font-normal py-2 pr-4">profile</th>
                  <th className="font-normal py-2 pr-4">synced</th>
                  <th className="font-normal py-2">size</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(p => {
                  const quiet = daysSinceStamp(p.last_sign_in_at);
                  return (
                    <tr key={p.id} className="border-t border-border align-top">
                      <td className="text-[13px] py-2 pr-4">
                        <span className="block">{p.email ?? shortId(p.id)}</span>
                        {!p.confirmed ? (
                          <span className="type-ledger text-[11px] text-text-2">unconfirmed</span>
                        ) : null}
                      </td>
                      <td className="text-[13px] py-2 pr-4 tabular">{formatStamp(p.created_at ?? '')}</td>
                      <td className="text-[13px] py-2 pr-4 tabular">
                        {p.last_sign_in_at ? formatStamp(p.last_sign_in_at) : 'never'}
                        {quiet !== null && quiet > 0 ? (
                          <span className="type-ledger text-[11px] text-text-2 block">
                            {quiet} {quiet === 1 ? 'day' : 'days'} ago
                          </span>
                        ) : null}
                      </td>
                      <td className="text-[13px] py-2 pr-4">
                        {p.profile ? (
                          <>
                            <span className="block">{p.profile.display_name ?? 'no name'}</span>
                            {p.profile.handle ? (
                              <span className="font-mono text-[11px] text-text-2">{p.profile.handle}</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-text-2">none</span>
                        )}
                      </td>
                      <td className="text-[13px] py-2 pr-4 tabular">{p.wardrobes}</td>
                      <td className="text-[13px] py-2 tabular">
                        {p.wardrobes > 0 ? formatBytes(p.bytes) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableRail>

          <p className="text-[13px] text-text-2 leading-relaxed mt-4">
            These are the account service's own records — who signed up, when, and what they chose to
            sync. No wardrobe's contents are read to build this table, and none can be: the stats
            service measures a row and never returns it.
          </p>
        </>
      )}
    </Card>
  );
}

/* ---------- the relay ---------- */

export function RelayHealth({
  services,
  probes,
  probing,
  disabled = false,
  onProbe,
  onProbeAll,
}: {
  services: RelayService[];
  probes: Record<string, ProbeResult | null>;
  probing: string | null;
  disabled?: boolean;
  onProbe: (service: RelayService) => void;
  onProbeAll: () => void;
}) {
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="type-label text-text">The relay</h2>
        <Button compact onClick={onProbeAll} disabled={disabled || probing !== null}>
          Probe all
        </Button>
      </div>

      <p className="text-[13px] text-text-2 leading-relaxed mb-4">
        A probe spends the house's own key, so nothing here is asked until you ask it.
      </p>

      <div className="space-y-3">
        {services.map(service => {
          const probe = probes[service.id] ?? null;
          const busy = probing === service.id;
          return (
            <div
              key={service.id}
              className="flex flex-wrap items-center gap-3 justify-between border-t border-border pt-3"
            >
              <div className="min-w-0">
                <p className="text-[15px] text-text">{service.label}</p>
                <p className="font-mono text-[11px] text-text-2 mt-0.5">{service.model}</p>
              </div>
              <div className="flex items-center gap-3 min-w-0">
                {busy ? (
                  <span className="type-ledger text-[11px] text-text-2">knocking</span>
                ) : probe ? (
                  <>
                    <Chip as="span">{probe.verdict}</Chip>
                    <span className="type-ledger text-[11px] text-text-2 tabular whitespace-nowrap">
                      {probe.status === null ? 'no answer' : probe.status} · {probe.latencyMs} ms
                    </span>
                  </>
                ) : (
                  <span className="type-ledger text-[11px] text-text-2">not probed</span>
                )}
                <Button compact onClick={() => onProbe(service)} disabled={disabled || probing !== null}>
                  Probe
                </Button>
              </div>
              {probe ? (
                <p className="w-full text-[13px] text-text-2 leading-relaxed">{probe.answer} {probe.costLabel ?? 'Cost unavailable for this probe.'}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {Object.values(probes).some(Boolean) ? null : (
        <p className="text-[13px] text-text-2 leading-relaxed mt-4">
          Not probed yet. Nothing is asked of the relay until you ask.
        </p>
      )}
    </Card>
  );
}

/* ---------- the honest floor ---------- */

export function NotRecorded() {
  return (
    <Card>
      <SectionTitle>What this board cannot see</SectionTitle>
      <p className="text-[14px] text-text-2 leading-relaxed">
        Everything above comes from the account service's own records: who made an account, when,
        and what they chose to sync. It cannot say what anybody put in a wardrobe, what they logged,
        or what a screen looked like when it went wrong — none of that is on the service at all.
      </p>
      <p className="text-[14px] text-text-2 leading-relaxed mt-3">
        The opt-in usage record is a separate source and is not on this board yet. A tester who has
        ticked the box sends counts and screen names; until those are read here, "did anyone open the
        closet twice" is a question this page cannot answer, and it should not be guessed from a
        signup date.
      </p>
      <p className="text-[14px] text-text-2 leading-relaxed mt-3">
        Nothing above is inferred, sampled or estimated. Every figure is one live answer from one
        service, read at the moment you pressed.
      </p>
    </Card>
  );
}
