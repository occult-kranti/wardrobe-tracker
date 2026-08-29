import { useState } from 'react';
import { Button, Card, Field, Masthead, SectionTitle, inputClass } from '../components/ui';
import { AlphaCount, NotRecorded, RelayHealth, Roster, WardrobeRows } from './sections';
import {
  RELAY_SERVICES,
  fetchAlphaStats,
  formatStamp,
  loadAdminToken,
  probeRelay,
  saveAdminToken,
  type AlphaStatsResult,
  type ProbeResult,
  type RelayService,
} from './lib/statsClient';

/**
 * THE ALPHA MONITOR — the project lead's board, and none of the closet.
 *
 * This is a separate build on a separate address. It has no router, no
 * wardrobe context, no service worker and no access to any wardrobe on this
 * machine. It reads two live services and reports exactly what they answer.
 *
 * NOTHING FIRES ON MOUNT. There is no useEffect that fetches, no interval, no
 * refresh timer. Two reasons, both concrete: a relay probe spends the house's
 * own tokens, and a board that asks before it is asked will show yesterday's
 * answer as though it were now. The owner presses; the board asks.
 */
export default function App() {
  const [token, setToken] = useState<string>(() => loadAdminToken());
  /** null is "not asked yet" and must never render as a zero. */
  const [stats, setStats] = useState<AlphaStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [probes, setProbes] = useState<Record<string, ProbeResult | null>>({});
  const [probing, setProbing] = useState<string | null>(null);

  const read = async () => {
    const key = token.trim();
    if (!key) return;
    saveAdminToken(key);
    setLoading(true);
    try {
      setStats(await fetchAlphaStats(key));
    } finally {
      setLoading(false);
    }
  };

  const probeOne = async (service: RelayService) => {
    setProbing(service.id);
    try {
      const result = await probeRelay(service);
      setProbes(prev => ({ ...prev, [service.id]: result }));
    } finally {
      setProbing(null);
    }
  };

  const probeAll = async () => {
    // Sequential, not concurrent: four at once is four simultaneous model calls
    // on one key, and the latency figures stop meaning anything when they queue
    // behind each other upstream.
    for (const service of RELAY_SERVICES) {
      await probeOne(service);
    }
  };

  const stamp =
    stats && stats.kind === 'ok' && stats.stats.generatedAt
      ? formatStamp(stats.stats.generatedAt)
      : 'not asked yet';

  return (
    <div className="min-h-dvh bg-bg pattern-paper">
      <main className="max-w-4xl mx-auto px-5 py-10 pb-20 space-y-6">
        <Masthead title="Alpha monitor" meta={stamp} />

        <p className="type-editorial text-[20px] leading-snug text-balance -mt-2">
          Two live sources: the stats service and the relay. Nothing on this board is estimated.
        </p>

        <Card>
          <SectionTitle aside="held for this tab only">The key</SectionTitle>
          <Field
            label="Admin token"
            htmlFor="admin-token"
            hint="Kept in this tab's session storage and sent as a header. It is never put in a URL, and the app's own pages cannot read it — this board is a different origin."
          >
            <input
              id="admin-token"
              type="password"
              className={inputClass}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="the token from the house's secrets"
              autoComplete="off"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button tone="primary" onClick={() => void read()} disabled={!token.trim() || loading}>
              {loading ? 'Reading' : 'Read the board'}
            </Button>
            <span className="text-[13px] text-text-2 leading-relaxed">
              {!token.trim()
                ? 'No token. The board stays blank until one is given.'
                : stats === null
                  ? 'A token is held for this tab. Nothing has been asked yet.'
                  : 'Press again to ask the service for a fresh count.'}
            </span>
          </div>
        </Card>

        <AlphaCount result={stats} loading={loading} />
        <Roster result={stats} loading={loading} />
        <WardrobeRows result={stats} loading={loading} />

        <RelayHealth
          services={RELAY_SERVICES}
          probes={probes}
          probing={probing}
          onProbe={service => void probeOne(service)}
          onProbeAll={() => void probeAll()}
        />

        <NotRecorded />

        <Card>
          <SectionTitle>Who can read this page</SectionTitle>
          <p className="text-[14px] text-text-2 leading-relaxed">
            Anyone who finds the address sees this shell and nothing else. Every figure on the board
            comes from the stats service, which refuses any request without the token, so a visitor
            without one is looking at empty furniture. The token is the whole lock; treat it as the
            secret it is.
          </p>
        </Card>
      </main>
    </div>
  );
}
