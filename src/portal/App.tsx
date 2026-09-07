import { useRef, useState } from 'react';
import { Button, Card, Field, Masthead, SectionTitle, inputClass } from '../components/ui';
import { AlphaCount, NotRecorded, RelayHealth, Roster, WardrobeRows } from './sections';
import Workbench from './Workbench';
import { RELAY_SERVICES, fetchAlphaStats, formatStamp, probeRelay, type AlphaStatsResult, type ProbeResult, type RelayService } from './lib/statsClient';

/** Public shell; all service requests are explicit and authenticated server-side. */
export default function App() {
  const [token, setToken] = useState('');
  const [epoch, setEpoch] = useState(0);
  const [view, setView] = useState<'monitor' | 'workbench'>('monitor');
  const [stats, setStats] = useState<AlphaStatsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [probes, setProbes] = useState<Record<string, ProbeResult | null>>({});
  const [probing, setProbing] = useState<string | null>(null);
  const [workbenchRunning, setWorkbenchRunning] = useState(false);
  const requestVersion = useRef(0);
  const monitorBusy = useRef(false);

  const changeToken = (next: string) => {
    requestVersion.current++; monitorBusy.current = false;
    setToken(next); setStats(null); setProbes({}); setLoading(false); setProbing(null); setWorkbenchRunning(false);
    setEpoch(value => value + 1);
  };
  const read = async () => {
    if (!token.trim() || monitorBusy.current || workbenchRunning) return;
    const version = requestVersion.current;
    monitorBusy.current = true; setLoading(true);
    try {
      const result = await fetchAlphaStats(token.trim());
      if (requestVersion.current === version) setStats(result);
    } finally {
      if (requestVersion.current === version) { setLoading(false); monitorBusy.current = false; }
    }
  };
  const probe = async (services: RelayService[]) => {
    if (!token.trim() || monitorBusy.current || workbenchRunning) return;
    const version = requestVersion.current;
    const key = token.trim(); monitorBusy.current = true;
    try {
      for (const service of services) {
        if (requestVersion.current !== version) break;
        setProbing(service.id);
        const result = await probeRelay(service, key);
        if (requestVersion.current === version) setProbes(previous => ({ ...previous, [service.id]: result }));
        if (result.status === 401 || result.status === 403) break;
      }
    } finally {
      if (requestVersion.current === version) { setProbing(null); monitorBusy.current = false; }
    }
  };
  const stamp = stats?.kind === 'ok' && stats.stats.generatedAt ? formatStamp(stats.stats.generatedAt) : 'not asked yet';

  return (
    <div className="min-h-dvh bg-bg pattern-paper">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-20 space-y-6 min-w-0">
        <Masthead title="Alpha monitor" meta={stamp} />
        <p className="type-editorial text-[20px] leading-snug">Operational records and deliberate model comparisons. Service counts are reported facts; model-call costs are labelled estimates.</p>
        <Card>
          <SectionTitle aside="memory only">The key</SectionTitle>
          <Field label="Admin token" htmlFor="admin-token" hint="Sent only as a request header to the admin services. Kept in page memory, never browser storage or a URL. Changing or forgetting it clears displayed records and workbench material.">
            <input id="admin-token" type="password" className={inputClass} value={token} onChange={event => changeToken(event.target.value)} placeholder="the token from the house's secrets" autoComplete="off" />
          </Field>
          <div className="flex flex-wrap gap-3 items-center mt-4">
            <Button onClick={() => changeToken('')} disabled={!token && stats === null && !Object.values(probes).some(Boolean)}>Forget this session</Button>
            <p className="text-[13px] text-text-2">{token.trim() ? 'A token is held in memory. Services check it when you press Run, Read or Probe.' : 'No token. Service requests stay disabled.'}</p>
          </div>
        </Card>
        <div role="group" aria-label="Portal view" className="flex flex-wrap gap-3">
          <Button aria-pressed={view === 'monitor'} onClick={() => setView('monitor')}>Operational monitor</Button>
          <Button aria-pressed={view === 'workbench'} onClick={() => setView('workbench')}>AI workbench</Button>
        </div>
        <section aria-label="Operational monitor" hidden={view !== 'monitor'} className="space-y-6">
          <Card>
            <div className="flex flex-wrap gap-3 items-center">
              <Button tone="primary" onClick={() => void read()} disabled={!token.trim() || loading || probing !== null || workbenchRunning}>{loading ? 'Reading' : 'Read the board'}</Button>
              <p className="text-[13px] text-text-2">{stats === null ? 'Not asked yet. Reading requests fresh operational records.' : 'Press again to ask the service for fresh records.'}</p>
            </div>
          </Card>
          <AlphaCount result={stats} loading={loading} />
          <Roster result={stats} loading={loading} />
          <WardrobeRows result={stats} loading={loading} />
          <RelayHealth services={RELAY_SERVICES} probes={probes} probing={probing} disabled={!token.trim() || loading || workbenchRunning} onProbe={service => void probe([service])} onProbeAll={() => void probe(RELAY_SERVICES)} />
          <NotRecorded />
        </section>
        <div hidden={view !== 'workbench'}>
          <Workbench key={epoch} token={loading || probing !== null ? '' : token} onRunningChange={setWorkbenchRunning} />
        </div>
        <Card>
          <SectionTitle>Who can read this page</SectionTitle>
          <p className="text-[14px] text-text-2 leading-relaxed">The portal shell is public, and its hosted address shares an origin with the consumer app. The server checks the admin token for operational records and every model call; hiding a panel is not the lock. The portal does not read the consumer wardrobe stores. Test material and results are visible in this open page and leave it only through an explicit model request or export. Provider processing and retention apply to material you send.</p>
        </Card>
      </main>
    </div>
  );
}
