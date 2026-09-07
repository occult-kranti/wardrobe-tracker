import { useState } from 'react';
import { Button, Card, Field, SectionTitle, Stat, inputClass } from './ui';
import {
  MOBILE_SCREEN_AUDITS,
  approveAllAttentionTasks,
  approveTask,
  consultTechLead,
  grantAllPermissions,
  grantPermission,
  loadAgentTasks,
  loadPermissions,
  rejectTask,
  revokePermission,
  type AgentTask,
  type LogicalPermission,
  type MobileScreenAudit,
  type TechLeadConsultation,
} from '../lib/techLead';

export function TechLeadTracker() {
  const [tasks, setTasks] = useState<AgentTask[]>(() => loadAgentTasks());
  const [permissions, setPermissions] = useState<LogicalPermission[]>(() => loadPermissions());
  const [taskFilter, setTaskFilter] = useState<'all' | 'attention-needed' | 'running' | 'completed'>('all');
  const [screenFilter, setScreenFilter] = useState<'all' | 'verified' | 'improved' | 'attention-needed'>('all');
  const [selectedScreen, setSelectedScreen] = useState<MobileScreenAudit | null>(null);

  // Tech lead consultation state
  const [consultQuery, setConsultQuery] = useState('');
  const [consulting, setConsulting] = useState(false);
  const [consultResult, setConsultResult] = useState<TechLeadConsultation | null>(null);

  const attentionCount = tasks.filter(t => t.status === 'attention-needed').length;
  const runningCount = tasks.filter(t => t.status === 'running').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const grantedPermsCount = permissions.filter(p => p.granted).length;

  const handleApproveTask = (id: string) => {
    const updated = approveTask(id);
    setTasks(updated);
  };

  const handleRejectTask = (id: string) => {
    const updated = rejectTask(id);
    setTasks(updated);
  };

  const handleApproveAll = () => {
    const updated = approveAllAttentionTasks();
    setTasks(updated);
  };

  const handleTogglePermission = (perm: LogicalPermission) => {
    const updated = perm.granted ? revokePermission(perm.id) : grantPermission(perm.id);
    setPermissions(updated);
  };

  const handleGrantAll = () => {
    const updated = grantAllPermissions();
    setPermissions(updated);
  };

  const handleConsult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultQuery.trim()) return;
    setConsulting(true);
    try {
      const res = consultTechLead(consultQuery.trim());
      setConsultResult(res);
    } finally {
      setConsulting(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (taskFilter === 'all') return true;
    return t.status === taskFilter;
  });

  const filteredScreens = MOBILE_SCREEN_AUDITS.filter(s => {
    if (screenFilter === 'all') return true;
    return s.status === screenFilter;
  });

  return (
    <div className="space-y-6">
      {/* KPI Overview & Master Controls */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <SectionTitle aside={`${grantedPermsCount}/${permissions.length} permissions active`}>
            Tech lead &amp; progress tracker
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              tone={attentionCount > 0 ? 'primary' : 'secondary'}
              disabled={attentionCount === 0}
              onClick={handleApproveAll}
            >
              {attentionCount > 0 ? `Approve all (${attentionCount} attention needed)` : 'All tasks authorized'}
            </Button>
            <Button compact tone="secondary" onClick={handleGrantAll}>
              Grant all permissions
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <Stat value={tasks.length} label="Total agent tasks" />
          <Stat
            value={attentionCount}
            label={attentionCount > 0 ? 'Attention needed' : '0 attention needed'}
          />
          <Stat value={runningCount} label="Currently executing" />
          <Stat value={completedCount} label="Completed gates" />
        </div>
      </Card>

      {/* Task Progress Board */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <SectionTitle aside={`${filteredTasks.length} shown`}>Agent task progress board</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'attention-needed', 'running', 'completed'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setTaskFilter(f)}
                className={`type-label px-2.5 py-1 text-[11px] rounded-[2px] border transition-colors ${
                  taskFilter === f
                    ? 'bg-ink text-on-ink border-ink'
                    : 'border-border text-text-2 hover:bg-sunken'
                }`}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'attention-needed'
                    ? `Attention (${attentionCount})`
                    : f === 'running'
                      ? `Running (${runningCount})`
                      : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-4 divide-y divide-border">
          {filteredTasks.map(task => (
            <li key={task.id} className="py-3.5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`type-ledger text-[10px] px-2 py-0.5 rounded-[2px] font-medium ${
                        task.status === 'completed'
                          ? 'bg-success/15 text-success'
                          : task.status === 'running'
                            ? 'bg-accent/15 text-accent'
                            : task.status === 'attention-needed'
                              ? 'bg-danger/15 text-danger font-bold'
                              : 'bg-sunken text-text-2'
                      }`}
                    >
                      {task.status.toUpperCase()}
                    </span>
                    <p className="text-[14px] text-text font-medium">{task.title}</p>
                  </div>
                  <p className="type-ledger text-[11px] text-text-2 mt-1">
                    {task.squad} · {task.role}
                    {task.requiredPermission ? ` · Requires: [${task.requiredPermission}]` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {task.status === 'attention-needed' && (
                    <>
                      <Button tone="primary" compact onClick={() => handleApproveTask(task.id)}>
                        Approve
                      </Button>
                      <Button tone="destructive" compact onClick={() => handleRejectTask(task.id)}>
                        Hold
                      </Button>
                    </>
                  )}
                  {task.status === 'running' && (
                    <Button compact tone="secondary" onClick={() => handleApproveTask(task.id)}>
                      Re-authorize
                    </Button>
                  )}
                  {task.status === 'completed' && (
                    <span className="type-ledger text-[11px] text-success font-medium">Verified Gate</span>
                  )}
                </div>
              </div>

              <p className="text-[13px] text-text-2 leading-relaxed">{task.summary}</p>

              {task.comments.length > 0 && (
                <div className="p-2.5 bg-sunken rounded-[2px] border border-border mt-2 space-y-1">
                  {task.comments.map((c, i) => (
                    <p key={i} className="text-[12px] text-text-2 leading-snug">
                      • {c}
                    </p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* Logical Permissions Matrix */}
      <Card>
        <SectionTitle aside="Subagent Capabilities">Logical permissions engine</SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Configure runtime authorization boundaries for parallel agent swarms. Granting permissions allows
          subagents to perform file modifications, test commands, and AI queries autonomously.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {permissions.map(perm => (
            <div
              key={perm.id}
              className={`p-3 rounded-[2px] border transition-colors ${
                perm.granted ? 'border-border bg-surface' : 'border-dashed border-border/80 bg-sunken'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] text-text font-medium">{perm.label}</p>
                  <p className="type-ledger text-[10px] text-accent mt-0.5">
                    {perm.id} · Risk: {perm.riskLevel.toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePermission(perm)}
                  className={`type-ledger text-[10px] px-2 py-0.5 rounded-[2px] font-medium border transition-colors ${
                    perm.granted
                      ? 'bg-success/15 text-success border-success/30'
                      : 'bg-sunken text-text-2 border-border hover:text-text'
                  }`}
                >
                  {perm.granted ? 'GRANTED' : 'REVOKED'}
                </button>
              </div>
              <p className="text-[12px] text-text-2 mt-1.5 leading-snug">{perm.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Tech Lead Consultation Console */}
      <Card>
        <SectionTitle aside="Architectural Supervisor">Consult tech lead</SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Ask the Tech Lead for architectural review, mobile readiness evaluation, or risk assessment for any
          feature or screen.
        </p>

        <form onSubmit={handleConsult} className="mt-4 space-y-3">
          <Field label="Inquiry / Proposed Change" htmlFor="techlead-query">
            <input
              id="techlead-query"
              className={inputClass}
              placeholder="e.g. Can we enable offline client-side background removal without breaking local-first?"
              value={consultQuery}
              onChange={e => setConsultQuery(e.target.value)}
            />
          </Field>
          <Button tone="primary" type="submit" disabled={consulting || !consultQuery.trim()}>
            {consulting ? 'Evaluating invariants…' : 'Consult tech lead'}
          </Button>
        </form>

        {consultResult && (
          <div className="mt-5 p-4 bg-sunken rounded-[2px] border border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="type-editorial text-[16px] text-text font-semibold">
                Tech Lead Evaluation
              </span>
              <span
                className={`type-ledger text-[11px] px-2 py-0.5 rounded-[2px] font-medium ${
                  consultResult.verdict === 'approved'
                    ? 'bg-success/15 text-success'
                    : 'bg-accent/15 text-accent'
                }`}
              >
                Verdict: {consultResult.verdict.toUpperCase()} · Risk: {consultResult.riskScore}/100
              </span>
            </div>

            <p className="text-[14px] text-text leading-snug">{consultResult.summary}</p>

            <div className="space-y-1 pt-2 border-t border-border">
              <p className="type-ledger text-[11px] text-text-2 font-medium">Architectural Invariants</p>
              {consultResult.architecturalInvariants.map((inv, idx) => (
                <p key={idx} className="text-[12px] text-text-2 flex items-start gap-1.5">
                  <span className="text-accent">•</span>
                  <span>{inv}</span>
                </p>
              ))}
            </div>

            <div className="space-y-1 pt-2 border-t border-border">
              <p className="type-ledger text-[11px] text-text-2 font-medium">Mobile Considerations</p>
              {consultResult.mobileConsiderations.map((mc, idx) => (
                <p key={idx} className="text-[12px] text-text-2 flex items-start gap-1.5">
                  <span className="text-success">•</span>
                  <span>{mc}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 18-Screen Mobile Audit Matrix */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <SectionTitle aside="18 of 18 Catalogued">Mobile screens audit &amp; review</SectionTitle>
            <p className="text-[13px] text-text-2 mt-0.5">
              Comprehensive evaluation of touch targets (44px floor), bottom sheets, and responsiveness.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(['all', 'verified', 'improved', 'attention-needed'] as const).map(sf => (
              <button
                key={sf}
                type="button"
                onClick={() => setScreenFilter(sf)}
                className={`type-label px-2.5 py-1 text-[11px] rounded-[2px] border transition-colors ${
                  screenFilter === sf
                    ? 'bg-ink text-on-ink border-ink'
                    : 'border-border text-text-2 hover:bg-sunken'
                }`}
              >
                {sf === 'all' ? 'All (18)' : sf.charAt(0).toUpperCase() + sf.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {filteredScreens.map(screen => (
            <button
              key={screen.id}
              type="button"
              onClick={() => setSelectedScreen(screen)}
              className={`p-3 rounded-[2px] border text-left transition-all ${
                selectedScreen?.id === screen.id
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-text-2 bg-surface'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <p className="text-[13px] text-text font-medium truncate">{screen.name}</p>
                <span
                  className={`type-ledger text-[9px] px-1.5 py-0.5 rounded-[2px] shrink-0 font-medium ${
                    screen.status === 'verified'
                      ? 'bg-success/15 text-success'
                      : screen.status === 'improved'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-danger/15 text-danger'
                  }`}
                >
                  {screen.status.toUpperCase()}
                </span>
              </div>

              <p className="type-ledger text-[10px] text-text-2 mt-0.5">
                Route: {screen.route} · Touch Score: {screen.touchTargetScore}/100
              </p>
              <p className="text-[12px] text-text-2 mt-1.5 line-clamp-2 leading-snug">
                {screen.mobileNotes}
              </p>
            </button>
          ))}
        </div>

        {/* Selected Screen Detail Inspector */}
        {selectedScreen && (
          <div className="mt-4 p-4 bg-sunken rounded-[2px] border border-border space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <div>
                <p className="type-masthead text-[16px] text-text font-semibold">
                  {selectedScreen.name} ({selectedScreen.route})
                </p>
                <p className="type-ledger text-[11px] text-text-2">
                  Component: <code>{selectedScreen.componentPath}</code>
                </p>
              </div>
              <span className="type-ledger text-[12px] px-2 py-1 rounded-[2px] bg-success/15 text-success font-bold">
                Touch Score: {selectedScreen.touchTargetScore}/100
              </span>
            </div>

            <p className="text-[13px] text-text leading-snug">{selectedScreen.mobileNotes}</p>

            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <p className="type-ledger text-[11px] text-text-2 font-medium">Comments &amp; Observations</p>
                {selectedScreen.comments.map((c, i) => (
                  <p key={i} className="text-[12px] text-text-2 leading-snug">
                    • {c}
                  </p>
                ))}
              </div>

              <div className="space-y-1">
                <p className="type-ledger text-[11px] text-accent font-medium">Improvements &amp; Changes</p>
                {selectedScreen.improvements.map((imp, i) => (
                  <p key={i} className="text-[12px] text-text leading-snug">
                    + {imp}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
