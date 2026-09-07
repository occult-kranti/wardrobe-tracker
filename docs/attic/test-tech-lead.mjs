#!/usr/bin/env node
/**
 * test-tech-lead.mjs — Test suite for Tech Lead Governance, Logical Permissions,
 * Task State Transitions, 'Approve All' operations, and 18-Screen Mobile Audit.
 *
 * Verifies:
 * 1. Default permissions matrix and risk level classifications.
 * 2. Granting, revoking, and 'grantAllPermissions' bulk actions.
 * 3. Task state lifecycle: pending -> attention-needed -> approved/running -> completed.
 * 4. 'approveAllAttentionTasks' unblocking all pending/attention-needed tasks.
 * 5. Full 18-screen mobile audit coverage: route, touch target score, component path.
 * 6. Tech Lead consultation reasoning and risk scoring.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Setup minimal browser storage mock for Node environment
const storageData = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storageData.get(k) ?? null,
    setItem: (k, v) => storageData.set(k, String(v)),
    removeItem: (k) => storageData.delete(k),
    clear: () => storageData.clear(),
    get length() { return storageData.size; },
    key: (i) => Array.from(storageData.keys())[i] ?? null,
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};

const dir = mkdtempSync(join(tmpdir(), 'techlead-test-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    techLead: fileURLToPath(new URL('../src/lib/techLead.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});

const techLeadModule = await import(pathToFileURL(join(dir, 'techLead.js')).href);
const {
  DEFAULT_LOGICAL_PERMISSIONS,
  INITIAL_AGENT_TASKS,
  MOBILE_SCREEN_AUDITS,
  loadPermissions,
  grantPermission,
  revokePermission,
  grantAllPermissions,
  loadAgentTasks,
  approveTask,
  rejectTask,
  approveAllAttentionTasks,
  registerAgentTask,
  consultTechLead,
} = techLeadModule;

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
  if (!ok) fail++;
};

console.log('\n--- 1. LOGICAL PERMISSIONS ENGINE ---');

const perms = loadPermissions();
check('DEFAULT_LOGICAL_PERMISSIONS contains all 7 core capability scopes',
  Array.isArray(perms) && perms.length === 7
);

const permIds = perms.map(p => p.id);
check('Permissions cover file I/O, commands, swarms, relays, and storage',
  permIds.includes('file:read') &&
  permIds.includes('file:write') &&
  permIds.includes('cmd:execute') &&
  permIds.includes('swarm:spawn') &&
  permIds.includes('relay:query') &&
  permIds.includes('storage:surgery') &&
  permIds.includes('network:sync')
);

// Test revoke & grant
revokePermission('storage:surgery');
const afterRevoke = loadPermissions().find(p => p.id === 'storage:surgery');
check('revokePermission disables permission', afterRevoke?.granted === false);

grantPermission('storage:surgery');
const afterGrant = loadPermissions().find(p => p.id === 'storage:surgery');
check('grantPermission enables permission', afterGrant?.granted === true);

grantAllPermissions();
const allGranted = loadPermissions().every(p => p.granted === true);
check('grantAllPermissions enables all permissions in bulk', allGranted);

console.log('\n--- 2. AGENT TASK QUEUE & APPROVALS ---');

const tasks = loadAgentTasks();
check('loadAgentTasks returns initial tasks catalog', Array.isArray(tasks) && tasks.length >= 5);

// Test task registration
registerAgentTask({
  id: 'test-agent-task-01',
  title: 'Test Swarm Task',
  squad: 'Test Squad',
  role: 'Test Runner',
  status: 'attention-needed',
  requiredPermission: 'cmd:execute',
  summary: 'Awaiting tech lead authorization',
  comments: ['Requires .venv environment access'],
});

const withNewTask = loadAgentTasks();
check('registerAgentTask registers new task with attention-needed status',
  withNewTask.some(t => t.id === 'test-agent-task-01' && t.status === 'attention-needed')
);

// Test single approve
approveTask('test-agent-task-01');
const afterApprove = loadAgentTasks().find(t => t.id === 'test-agent-task-01');
check('approveTask moves status to running and appends approval log',
  afterApprove?.status === 'running' && afterApprove.comments.some(c => c.includes('Approved by Tech Lead'))
);

// Test reject
rejectTask('test-agent-task-01', 'Manual security boundary');
const afterReject = loadAgentTasks().find(t => t.id === 'test-agent-task-01');
check('rejectTask moves status to blocked with reason',
  afterReject?.status === 'blocked' && afterReject.comments.some(c => c.includes('Blocked by Tech Lead'))
);

// Test 'Approve All'
registerAgentTask({
  id: 'test-batch-01',
  title: 'Batch Task 1',
  squad: 'Squad A',
  role: 'Worker',
  status: 'attention-needed',
  summary: 'Need approval',
  comments: [],
});
registerAgentTask({
  id: 'test-batch-02',
  title: 'Batch Task 2',
  squad: 'Squad B',
  role: 'Worker',
  status: 'pending',
  summary: 'Need approval',
  comments: [],
});

approveAllAttentionTasks();
const afterBatch = loadAgentTasks();
const batch1 = afterBatch.find(t => t.id === 'test-batch-01');
const batch2 = afterBatch.find(t => t.id === 'test-batch-02');
check('approveAllAttentionTasks moves attention-needed & pending tasks to running',
  batch1?.status === 'running' && batch2?.status === 'running'
);

console.log('\n--- 3. 18-SCREEN MOBILE AUDIT COVERAGE ---');

check('MOBILE_SCREEN_AUDITS contains exactly 18 mobile screens',
  Array.isArray(MOBILE_SCREEN_AUDITS) && MOBILE_SCREEN_AUDITS.length === 18,
  `got ${MOBILE_SCREEN_AUDITS.length}`
);

const ROOT = fileURLToPath(new URL('..', import.meta.url));
for (const screen of MOBILE_SCREEN_AUDITS) {
  const compExists = existsSync(join(ROOT, screen.componentPath));
  check(`Screen '${screen.name}' (${screen.route}) component exists on disk`, compExists, screen.componentPath);
  check(`Screen '${screen.name}' touch target score >= 90`, screen.touchTargetScore >= 90, `got ${screen.touchTargetScore}`);
  check(`Screen '${screen.name}' has comments and improvements documented`,
    screen.comments.length > 0 && screen.improvements.length > 0
  );
}

console.log('\n--- 4. TECH LEAD CONSULTATION ENGINE ---');

const consultStandard = consultTechLead('How do we handle offline mobile image segmentation?');
check('consultTechLead returns approved verdict for mobile performance query',
  consultStandard.verdict === 'approved' && consultStandard.riskScore < 30
);
check('consultTechLead includes invariants, mobile considerations, and action items',
  consultStandard.architecturalInvariants.length > 0 &&
  consultStandard.mobileConsiderations.length > 0 &&
  consultStandard.actionItems.length > 0
);

const consultDestructive = consultTechLead('Requesting permission for database purge and storage surgery');
check('consultTechLead flags caution and elevated risk score for destructive operations',
  consultDestructive.verdict === 'caution' && consultDestructive.riskScore >= 70
);

console.log('\n============================================================');
if (fail === 0) {
  console.log('ALL TECH LEAD & MOBILE AUDIT CHECKS PASSED (exit code 0)');
  console.log('============================================================');
  process.exit(0);
} else {
  console.log(`FAILED with ${fail} errors`);
  console.log('============================================================');
  process.exit(1);
}

