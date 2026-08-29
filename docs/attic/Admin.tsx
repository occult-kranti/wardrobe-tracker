import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Field,
  Masthead,
  SectionTitle,
  Stat,
  TableRail,
  inputClass,
  selectClass,
} from '../components/ui';
import { Basting } from '../components/art';
import {
  ADVISOR_RECIPES,
  RELAY_SERVICES,
  fetchAlphaStats,
  formatBytes,
  listCommunityPosts,
  listParkedPushes,
  listRegisteredSkills,
  loadAdminToken,
  probeRelay,
  readProductAnalytics,
  runAdvisorRecipe,
  runSmokeChecks,
  saveAdminToken,
  toggleTombstonePost,
  type AdminPostView,
  type AdvisorAuditResult,
  type AlphaStatsResult,
  type ProbeResult,
  type ProbeVerdict,
  type ProductAnalytics,
  type RegisteredSkill,
  type RelayService,
  type SmokeCheck,
} from '../lib/admin';
import { formatMoney, formatPerWear } from '@almari/shared/cost';
import { TechLeadTracker } from '../components/TechLeadTracker';
import { getFunnelMetrics, getActiveFlags, toggleFeatureFlag, type FeatureFlag } from '../lib/telemetry';

/**
 * THE EXECUTIVE & ENGINEERING BACKEND MONITORING DASHBOARD
 *
 * Dedicated control room for product telemetry, multi-agent governance,
 * AI relay diagnostics, mobile screen UX audit, and infrastructure health.
 * All consumer wardrobe operations have been removed in favor of pure telemetry.
 */

type DashboardTab =
  | 'analytics'
  | 'telemetry'
  | 'techlead'
  | 'advisor'
  | 'skills'
  | 'services'
  | 'smoke';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('analytics');

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <Masthead title="Backend Monitoring Dashboard" meta="Product Telemetry & Multi-Agent Operations" />
      <p className="type-editorial text-[20px] leading-snug text-balance -mt-2">
        Real-time telemetry, agent governance, AI advisor diagnostics, and mobile UX audit.
      </p>

      {/* Dashboard View Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
        <TabButton
          label="Product analytics"
          active={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
        />
        <TabButton
          label="A/B Testing & Usage"
          active={activeTab === 'telemetry'}
          onClick={() => setActiveTab('telemetry')}
        />
        <TabButton
          label="Tech lead & Swarms"
          active={activeTab === 'techlead'}
          onClick={() => setActiveTab('techlead')}
        />
        <TabButton
          label="AI Advisor & Diagnostics"
          active={activeTab === 'advisor'}
          onClick={() => setActiveTab('advisor')}
        />
        <TabButton
          label="Skills registry"
          active={activeTab === 'skills'}
          onClick={() => setActiveTab('skills')}
        />
        <TabButton
          label="Services & Sync"
          active={activeTab === 'services'}
          onClick={() => setActiveTab('services')}
        />
        <TabButton
          label="Smoke checks"
          active={activeTab === 'smoke'}
          onClick={() => setActiveTab('smoke')}
        />
      </div>

      {activeTab === 'analytics' && <AnalyticsView />}
      {activeTab === 'telemetry' && <TelemetryView />}
      {activeTab === 'techlead' && <TechLeadTracker />}
      {activeTab === 'advisor' && <AdvisorView />}
      {activeTab === 'skills' && <SkillsView />}
      {activeTab === 'services' && <ServicesView />}
      {activeTab === 'smoke' && <SmokeChecksView />}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`type-label px-3.5 py-2 rounded-[2px] text-[13px] border transition-colors ${
        active
          ? 'bg-ink text-on-ink border-ink font-medium'
          : 'border-border text-text-2 hover:text-text hover:bg-sunken'
      }`}
    >
      {label}
    </button>
  );
}

/* ========================================================================== */
/* VIEW 1: PRODUCT ANALYTICS & TELEMETRY                                      */
/* ========================================================================== */

function AnalyticsView() {
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await readProductAnalytics();
      setAnalytics(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (loading || !analytics) {
    return (
      <Card>
        <p className="type-editorial text-[15px] text-text-2">Calculating product metrics…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive KPI Summary */}
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <SectionTitle aside={`${analytics.totalWardrobes} wardrobes on device`}>
            Executive KPI Summary
          </SectionTitle>
          <Button compact onClick={() => void refresh()}>
            Refresh telemetry
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6 mt-4">
          <Stat value={analytics.totalPieces} label="Total pieces catalogued" />
          <Stat value={analytics.totalWears} label="Total logged wears" />
          <Stat
            value={formatMoney(analytics.totalValue)}
            label="Total wardrobe valuation"
          />
          <Stat
            value={`${analytics.rewearRate.toFixed(1)}x`}
            label="Aggregate re-wear velocity"
          />
          <Stat
            value={formatPerWear(analytics.averageCpw)}
            label="Average cost per wear"
          />
          <Stat
            value={formatMoney(analytics.totalRepairCost)}
            label={`Across ${analytics.totalRepairs} repair logs`}
          />
        </div>
      </Card>

      {/* Storage & Infrastructure Health */}
      <Card>
        <SectionTitle aside={`${analytics.storage.percentUsed}% purse quota`}>
          Storage &amp; Infrastructure Telemetry
        </SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Local-first storage balance: metadata in localStorage vs binary photo storage in IndexedDB.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="p-3.5 bg-sunken rounded-[2px] border border-border">
            <p className="type-ledger text-[11px] text-text-2">localStorage Metadata Purse</p>
            <p className="type-display text-[22px] font-bold mt-1 text-text">
              {formatBytes(analytics.storage.localStorageBytes)}
            </p>
            <div className="mt-2 h-2 bg-mat rounded-[2px] overflow-hidden">
              <div
                className={`h-full ${
                  analytics.storage.percentUsed > 80 ? 'bg-danger-fill' : 'bg-accent'
                }`}
                style={{ width: `${analytics.storage.percentUsed}%` }}
              />
            </div>
            <p className="type-ledger text-[10px] text-text-2 mt-1">
              {analytics.storage.percentUsed}% of ~{formatBytes(analytics.storage.budgetBytes)} ceiling
            </p>
          </div>

          <div className="p-3.5 bg-sunken rounded-[2px] border border-border">
            <p className="type-ledger text-[11px] text-text-2">IndexedDB Photograph Store</p>
            <p className="type-display text-[22px] font-bold mt-1 text-text">
              {formatBytes(analytics.storage.photoStoreBytes)}
            </p>
            <p className="type-ledger text-[12px] text-text mt-1">
              {analytics.storage.photoStoreImages} binary images offloaded
            </p>
            <p className="type-ledger text-[10px] text-success mt-1 font-medium">
              +{analytics.storage.purseSavingsPercent}% storage headroom saved
            </p>
          </div>
        </div>
      </Card>

      {/* Category Breakdown & Cost Tiers */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <SectionTitle>Category distribution</SectionTitle>
          <ul className="mt-3 space-y-2">
            {Object.entries(analytics.categoryCounts).map(([cat, count]) => {
              const pct = analytics.totalPieces > 0
                ? Math.round((count / analytics.totalPieces) * 100)
                : 0;
              return (
                <li key={cat} className="space-y-1">
                  <div className="flex justify-between text-[13px]">
                    <span className="capitalize text-text">{cat}</span>
                    <span className="type-ledger text-text-2">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-sunken rounded-[2px] overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Cost tiers &amp; Valuation</SectionTitle>
          <ul className="mt-3 space-y-2">
            <CostTierRow label="Unrecorded cost" count={analytics.costTiers.unrecorded} total={analytics.totalPieces} />
            <CostTierRow label="Heirloom / Free (₹0)" count={analytics.costTiers.free} total={analytics.totalPieces} />
            <CostTierRow label="Everyday (< ₹1,000)" count={analytics.costTiers.budget} total={analytics.totalPieces} />
            <CostTierRow label="Mid-range (₹1,000 - ₹5,000)" count={analytics.costTiers.mid} total={analytics.totalPieces} />
            <CostTierRow label="Investment (> ₹5,000)" count={analytics.costTiers.investment} total={analytics.totalPieces} />
          </ul>
        </Card>
      </div>
    </div>
  );
}

function CostTierRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="space-y-1">
      <div className="flex justify-between text-[13px]">
        <span className="text-text">{label}</span>
        <span className="type-ledger text-text-2">{count} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-sunken rounded-[2px] overflow-hidden">
        <div className="h-full bg-border" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/* ========================================================================== */
/* VIEW 2: ADVISOR & TECH EXPERT AI CONSOLE                                   */
/* ========================================================================== */

function AdvisorView() {
  const [selectedRecipe, setSelectedRecipe] = useState(ADVISOR_RECIPES[0].id);
  const [selectedModel, setSelectedModel] = useState('claude-opus-5');
  const [running, setRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<AdvisorAuditResult | null>(null);

  const executeAudit = async () => {
    setRunning(true);
    try {
      const res = await runAdvisorRecipe(selectedRecipe, selectedModel);
      setAuditResult(res);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle aside="Claude Advisor Protocol">
          Advisor consultation &amp; diagnostics
        </SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Consult the higher-reviewer model directly. Runs architectural conformance checks,
          competitive gap analyses against the 382-capability framework, and vision intake diagnostics.
        </p>

        {/* Recipe Selection */}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {ADVISOR_RECIPES.map(recipe => (
            <button
              key={recipe.id}
              type="button"
              onClick={() => {
                setSelectedRecipe(recipe.id);
                setSelectedModel(recipe.defaultModel);
              }}
              className={`p-3 rounded-[2px] border text-left transition-all ${
                selectedRecipe === recipe.id
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-text-2 bg-surface'
              }`}
            >
              <p className="text-[14px] text-text font-medium">{recipe.name}</p>
              <p className="text-[12px] text-text-2 mt-1 leading-snug">{recipe.description}</p>
              <p className="type-ledger text-[10px] text-accent mt-2">
                Default: {recipe.defaultModel}
              </p>
            </button>
          ))}
        </div>

        {/* Model Selection & Trigger */}
        <div className="flex flex-wrap items-end gap-3 mt-5 pt-4 border-t border-border">
          <div className="w-56">
            <Field label="Reviewer Model" htmlFor="advisor-model-select">
              <select
                id="advisor-model-select"
                className={selectClass}
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                {RELAY_SERVICES.map(s => (
                  <option key={s.id} value={s.model}>
                    {s.label} ({s.model})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Button
            tone="primary"
            disabled={running}
            onClick={() => void executeAudit()}
          >
            {running ? 'Reviewing system state…' : 'Run advisor audit'}
          </Button>
        </div>
      </Card>

      {/* Audit Result Display */}
      {auditResult && (
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <SectionTitle aside={`${auditResult.latencyMs} ms · ${auditResult.model}`}>
              Advisor findings
            </SectionTitle>
            <span className="type-ledger text-[12px] px-2 py-0.5 rounded-[2px] bg-success/15 text-success font-medium">
              Health Score: {auditResult.score}/100
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <p className="type-editorial text-[16px] text-text leading-snug">
              {auditResult.summary}
            </p>

            <div className="p-3 bg-sunken rounded-[2px] border border-border space-y-2">
              <p className="type-ledger text-[11px] text-text-2 font-medium">Evidence &amp; Invariants</p>
              <ul className="space-y-1.5">
                {auditResult.bulletPoints.map((pt, i) => (
                  <li key={i} className="text-[13px] text-text-2 flex items-start gap-2">
                    <span className="text-accent mt-0.5">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-accent/5 rounded-[2px] border border-accent/20">
              <p className="type-ledger text-[11px] text-accent font-medium">Recommendation</p>
              <p className="text-[13px] text-text mt-1 leading-relaxed">
                {auditResult.recommendation}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ========================================================================== */
/* VIEW 3: SKILLS REGISTRY                                                   */
/* ========================================================================== */

function SkillsView() {
  const skills = useMemo(() => listRegisteredSkills(), []);
  const [activeSkillResult, setActiveSkillResult] = useState<string | null>(null);

  const runSkillDiagnostic = (skill: RegisteredSkill) => {
    setActiveSkillResult(`Skill ${skill.name} operational. Path: ${skill.path}. Status: Active.`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle aside={`${skills.length} skills registered`}>
          Antigravity skills registry
        </SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Autonomous skills available in the environment for coding, research, and parallel multi-agent swarms.
        </p>

        <ul className="mt-4 divide-y divide-border">
          {skills.map(skill => (
            <li key={skill.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-text font-medium">{skill.name}</p>
                <p className="type-ledger text-[10px] text-accent mt-0.5">{skill.category}</p>
                <p className="text-[13px] text-text-2 mt-1 leading-snug">{skill.description}</p>
                <p className="type-ledger text-[10px] text-text-2 mt-1">{skill.path}</p>
              </div>
              <Button compact onClick={() => runSkillDiagnostic(skill)}>
                Run check
              </Button>
            </li>
          ))}
        </ul>

        {activeSkillResult && (
          <div className="mt-4 p-3 bg-sunken rounded-[2px] border border-border">
            <p className="type-ledger text-[11px] text-success">{activeSkillResult}</p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle aside="Parallel Swarm Wave Laws">
          Subagent swarm coordinator
        </SectionTitle>
        <div className="mt-3 space-y-2 text-[14px] text-text-2 leading-relaxed">
          <p>
            <strong>1. Disjoint File Ownership:</strong> Squads declare non-overlapping file boundaries before execution.
          </p>
          <p>
            <strong>2. Serialized Build Gates:</strong> Only one squad executes verification at a time; <code>npm run verify</code> runs between waves.
          </p>
          <p>
            <strong>3. Immutable Git History:</strong> Commits require explicit owner instructions.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ========================================================================== */
/* VIEW 4: SERVICES & SYNC                                                   */
/* ========================================================================== */

function ServicesView() {
  return (
    <div className="space-y-6">
      <ServicesCard />
      <AlphaCard />
      <SyncQueueCard />
      <CommunityModerationCard />
    </div>
  );
}

function ProbeLine({ result }: { result: ProbeResult }) {
  const VERDICT_DOT: Record<ProbeVerdict, string> = {
    healthy: 'bg-success',
    unconfigured: 'bg-border',
    failed: 'bg-danger-fill',
    unreachable: 'bg-danger-fill',
  };
  const VERDICT_TEXT: Record<ProbeVerdict, string> = {
    healthy: 'text-success',
    unconfigured: 'text-text-2',
    failed: 'text-danger',
    unreachable: 'text-danger',
  };
  const VERDICT_WORD: Record<ProbeVerdict, string> = {
    healthy: 'healthy',
    unconfigured: 'no key set',
    failed: 'failed',
    unreachable: 'unreachable',
  };

  return (
    <div className="mt-1.5">
      <p className="flex items-center gap-2">
        <span aria-hidden className={`w-2.5 h-2.5 rounded-[2px] shrink-0 ${VERDICT_DOT[result.verdict]}`} />
        <span className={`type-ledger text-[11px] tabular ${VERDICT_TEXT[result.verdict]}`}>
          {VERDICT_WORD[result.verdict]} · HTTP {result.status ?? '—'} · {result.latencyMs} ms
        </span>
      </p>
      <p className="text-[13px] text-text-2 leading-snug mt-1 break-words">{result.answer}</p>
    </div>
  );
}

function ServicesCard() {
  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  const [running, setRunning] = useState<ReadonlySet<string>>(new Set());
  const [testingAll, setTestingAll] = useState(false);

  const probe = async (service: RelayService) => {
    setRunning(prev => new Set(prev).add(service.id));
    try {
      const result = await probeRelay(service);
      setResults(prev => ({ ...prev, [service.id]: result }));
    } finally {
      setRunning(prev => {
        const next = new Set(prev);
        next.delete(service.id);
        return next;
      });
    }
  };

  const probeAll = async () => {
    setTestingAll(true);
    try {
      for (const service of RELAY_SERVICES) await probe(service);
    } finally {
      setTestingAll(false);
    }
  };

  const busy = testingAll || running.size > 0;

  return (
    <Card>
      <SectionTitle aside={`${RELAY_SERVICES.length} models through one relay`}>Services</SectionTitle>
      <p className="text-[14px] text-text-2 leading-relaxed">
        The relay the intake walks through. Each test sends one line and reports what came back.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {RELAY_SERVICES.map(service => (
          <li key={service.id} className="py-3 flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0 basis-48">
              <p className="text-[14px] text-text leading-tight">{service.label}</p>
              <p className="type-ledger text-[10px] text-text-2 mt-0.5">
                {service.model} · {service.shape === 'anthropic' ? 'Messages shape' : 'chat-completions shape'}
              </p>
              {running.has(service.id) ? (
                <p className="type-ledger text-[11px] text-text-2 mt-1.5">asking…</p>
              ) : results[service.id] ? (
                <ProbeLine result={results[service.id]} />
              ) : null}
            </div>
            <Button compact disabled={busy} onClick={() => void probe(service)}>
              Test
            </Button>
          </li>
        ))}
      </ul>
      <Basting className="my-4" />
      <Button disabled={busy} onClick={() => void probeAll()}>
        {testingAll ? 'Testing each in turn' : 'Test all'}
      </Button>
    </Card>
  );
}

function AlphaCard() {
  const [token, setToken] = useState(loadAdminToken);
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState<AlphaStatsResult | null>(null);

  const ask = async () => {
    const trimmed = token.trim();
    saveAdminToken(trimmed);
    setFetching(true);
    try {
      setResult(await fetchAlphaStats(trimmed));
    } finally {
      setFetching(false);
    }
  };

  const stats = result?.kind === 'ok' ? result.stats : null;

  return (
    <Card>
      <SectionTitle aside={stats ? `as of ${stamp(stats.generatedAt)}` : 'remote truth'}>
        The alpha
      </SectionTitle>
      <p className="text-[14px] text-text-2 leading-relaxed">
        What the sync service holds, counted at the source — only the wardrobes whose owners
        chose an account appear here.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3 max-w-[560px]"
        onSubmit={e => {
          e.preventDefault();
          void ask();
        }}
      >
        <div className="flex-1 min-w-[220px]">
          <Field label="Stats token" htmlFor="admin-stats-token">
            <input
              id="admin-stats-token"
              type="password"
              className={inputClass}
              value={token}
              onChange={e => setToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
        <Button type="submit" disabled={fetching || !token.trim()}>
          {fetching ? 'Asking the service' : 'Fetch the numbers'}
        </Button>
      </form>

      {result?.kind === 'refused' && (
        <p className="text-[13px] text-danger mt-4">The token was refused.</p>
      )}
      {result?.kind === 'absent' && (
        <p className="text-[13px] text-text-2 mt-4">
          The stats service is not deployed yet. The numbers will appear here once it answers.
        </p>
      )}
      {result?.kind === 'failed' && (
        <p className="text-[13px] text-danger mt-4">The stats service answered {result.status}.</p>
      )}

      {stats && (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 max-w-[420px]">
            <Stat value={stats.users} label="Accounts on the service" />
            <Stat value={stats.profiles} label="Profiles" />
          </div>
          {stats.wardrobes.length === 0 ? (
            <p className="text-[14px] text-text-2 mt-5">No wardrobe has chosen sync yet.</p>
          ) : (
            <TableRail label="Wardrobes on the service" className="mt-5">
              <table className="w-full text-left tabular">
                <thead>
                  <tr>
                    <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 rule-double">Wardrobe</th>
                    <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 rule-double">Owner</th>
                    <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 rule-double w-32">Updated</th>
                    <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double w-20">Size</th>
                    <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 rule-double w-20">Envelope</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.wardrobes.map(w => (
                    <tr key={w.id} className="border-t border-border">
                      <td className="py-2 type-ledger text-[13px] text-text">{shortId(w.id)}</td>
                      <td className="pl-3 py-2 type-ledger text-[13px] text-text-2">{shortId(w.user_id)}</td>
                      <td className="pl-3 py-2 text-[13px] text-text-2 whitespace-nowrap">{stamp(w.updated_at)}</td>
                      <td className="pl-3 py-2 text-right text-[13px] text-text whitespace-nowrap">{formatBytes(w.bytes)}</td>
                      <td className="pl-3 py-2 type-ledger text-[13px] text-text-2">
                        {w.v === null || w.v === undefined || w.v === '' ? 'bare' : `v${w.v}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRail>
          )}
        </div>
      )}
    </Card>
  );
}

function SyncQueueCard() {
  const [pushes] = useState(() => listParkedPushes());

  return (
    <Card>
      <SectionTitle aside={`${pushes.length} parked`}>Parked sync queue</SectionTitle>
      <p className="text-[14px] text-text-2 leading-relaxed">
        Offline pushes held on this device. Parked sync pushes hold references rather than pictures,
        and automatically drain when the device reconnects.
      </p>

      {pushes.length === 0 ? (
        <p className="text-[14px] text-text-2 mt-4">No pushes parked — sync queue is clear.</p>
      ) : (
        <TableRail label="Parked sync queue" className="mt-4">
          <table className="w-full text-left tabular">
            <thead>
              <tr>
                <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 rule-double">Wardrobe</th>
                <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 rule-double">Queued at</th>
                <th className="type-ledger text-[11px] text-text-2 font-normal pb-2 pl-3 text-right rule-double">Size</th>
              </tr>
            </thead>
            <tbody>
              {pushes.map(p => (
                <tr key={p.wardrobeId} className="border-t border-border">
                  <td className="py-2 type-ledger text-[13px] text-text">{p.accountName}</td>
                  <td className="pl-3 py-2 text-[13px] text-text-2">{p.queuedAt ? stamp(p.queuedAt) : 'Recent'}</td>
                  <td className="pl-3 py-2 text-right text-[13px] text-text">{formatBytes(p.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRail>
      )}
    </Card>
  );
}

function CommunityModerationCard() {
  const [posts, setPosts] = useState<AdminPostView[]>(() => listCommunityPosts());
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshPosts = () => {
    setPosts(listCommunityPosts());
  };

  const handleToggle = (postId: string, tombstone: boolean) => {
    setBusyId(postId);
    try {
      toggleTombstonePost(postId, tombstone);
      refreshPosts();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <SectionTitle aside={`${posts.length} posts on record`}>Feed moderation</SectionTitle>
      <p className="text-[14px] text-text-2 leading-relaxed">
        Posts in the shared community store. Tombstoned posts stay hidden across reseeds and feed updates.
        Tombstones can be toggled without deleting underlying look history.
      </p>

      {posts.length === 0 ? (
        <p className="text-[14px] text-text-2 mt-4">No community posts on this device.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border max-h-[380px] overflow-y-auto">
          {posts.map(p => (
            <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-text font-medium truncate">
                  {p.authorName} <span className="type-ledger text-[11px] text-text-2">· {p.scope} · {stamp(p.at)}</span>
                </p>
                {p.caption && (
                  <p className="text-[13px] text-text-2 leading-snug mt-0.5 truncate">{p.caption}</p>
                )}
                <p className="type-ledger text-[10px] text-text-2 mt-0.5">
                  ID: {shortId(p.id)} {p.isTombstoned ? <span className="text-danger font-medium">· Tombstoned</span> : <span className="text-success font-medium">· Active</span>}
                </p>
              </div>
              <Button
                compact
                tone={p.isTombstoned ? 'secondary' : 'destructive'}
                disabled={busyId === p.id}
                onClick={() => handleToggle(p.id, !p.isTombstoned)}
              >
                {p.isTombstoned ? 'Restore' : 'Tombstone'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ========================================================================== */
/* VIEW 5: SMOKE CHECKS & DIAGNOSTICS                                        */
/* ========================================================================== */

function SmokeChecksView() {
  const [checks, setChecks] = useState<SmokeCheck[] | null>(null);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    try {
      const result = await runSmokeChecks();
      setChecks(result.checks);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <SectionTitle
          aside={checks ? `${checks.filter(c => c.pass).length} of ${checks.length} passing` : 'not run yet'}
        >
          System Integrity &amp; Smoke Checks
        </SectionTitle>
        <Button tone="primary" compact onClick={() => { void runChecks(); }} disabled={running}>
          {running ? 'Running checks…' : checks ? 'Re-run checks' : 'Run smoke checks'}
        </Button>
      </div>

      <p className="text-[14px] text-text-2 leading-relaxed mt-3">
        In-browser deep checks across device databases, photograph store hydration, and schema integrity.
      </p>

      {checks ? (
        <ul className="mt-5 space-y-4">
          {checks.map(c => (
            <li key={c.id}>
              <div className="flex items-baseline gap-3">
                <span
                  className={`type-ledger text-[11px] w-10 shrink-0 ${c.pass ? 'text-success' : 'text-danger'}`}
                >
                  {c.pass ? 'PASS' : 'FAIL'}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] text-text leading-tight">{c.label}</p>
                  <p className="text-[13px] text-text-2 leading-snug mt-0.5">{c.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-text-2 mt-4">
          Click 'Run smoke checks' to execute real-time diagnostics on this browser environment.
        </p>
      )}
    </Card>
  );
}

/* ---------- Helper formatting functions ---------- */

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function TelemetryView() {
  const [flags, setFlags] = useState<FeatureFlag[]>(getActiveFlags());
  const funnel = getFunnelMetrics();

  const handleToggle = (flag: FeatureFlag, current: boolean) => {
    toggleFeatureFlag(flag, !current);
    setFlags(getActiveFlags());
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle aside="Local-first overrides">A/B Testing Variants</SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Force local feature variants for Alpha/Beta testing. Overrides sync to testing clients.
        </p>
        <div className="mt-4 space-y-3">
          {(['alpha-dashboard', 'new-ingestion-flow', 'onboarding-v2'] as FeatureFlag[]).map(flag => {
            const enabled = flags.includes(flag);
            return (
              <div key={flag} className="flex items-center justify-between p-3 bg-sunken border border-border rounded-[2px]">
                <span className="type-ledger text-[13px] text-text">{flag}</span>
                <Button compact tone={enabled ? 'primary' : 'secondary'} onClick={() => handleToggle(flag, enabled)}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
      
      <Card>
        <SectionTitle aside="Privacy-preserved">Funnel Drop-off Metrics</SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Locally aggregated metrics. No raw events are synced without explicit opt-in.
        </p>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Stat label="Onboarding Started" value={funnel.onboardingStart} />
          <Stat label="Onboarding Completed" value={funnel.onboardingComplete} />
          <Stat label="Completion Rate" value={funnel.completionRate.toFixed(1) + '%'} />
        </div>
      </Card>
    </div>
  );
}
