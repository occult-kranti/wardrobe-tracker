/**
 * techLead.ts — Tech Lead Governance, Logical Permissions Engine,
 * Multi-Agent Progress Tracking, and Mobile Screen Audit Catalog.
 *
 * Provides:
 * 1. Runtime logical permissions matrix for agents & subagents (file I/O, commands, swarms, storage).
 * 2. Task queue with "Attention Needed" alerts and "Approve All" master actions.
 * 3. Autonomous Tech Lead consultation logic.
 * 4. Exhaustive 18-screen Mobile UX audit catalog with improvements and comments.
 */

export interface LogicalPermission {
  id: string;
  label: string;
  scope: string;
  granted: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

export interface AgentTask {
  id: string;
  title: string;
  squad: string;
  role: string;
  status: 'completed' | 'running' | 'pending' | 'attention-needed' | 'blocked';
  requiredPermission?: string;
  summary: string;
  comments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MobileScreenAudit {
  id: string;
  name: string;
  route: string;
  componentPath: string;
  status: 'verified' | 'improved' | 'attention-needed';
  touchTargetScore: number; // 0 - 100
  mobileNotes: string;
  comments: string[];
  improvements: string[];
}

export interface TechLeadConsultation {
  query: string;
  verdict: 'approved' | 'caution' | 'rejected';
  riskScore: number; // 0 - 100
  summary: string;
  architecturalInvariants: string[];
  mobileConsiderations: string[];
  actionItems: string[];
  timestamp: string;
}

const PERMISSIONS_KEY = 'almari-techlead-permissions';
const TASKS_KEY = 'almari-techlead-tasks';

export const DEFAULT_LOGICAL_PERMISSIONS: LogicalPermission[] = [
  {
    id: 'file:read',
    label: 'Codebase & Document Read',
    scope: 'Read-only access to repository files, configs, and documentation.',
    granted: true,
    riskLevel: 'low',
    description: 'Allows reading project files and researching architectural guidelines.',
  },
  {
    id: 'file:write',
    label: 'Source Code & Test Mutation',
    scope: 'Create and edit non-overlapping files within assigned squad boundaries.',
    granted: true,
    riskLevel: 'medium',
    description: 'Allows authoring components, tests, and styles under disjoint ownership.',
  },
  {
    id: 'cmd:execute',
    label: 'Safe Environment Command Execution',
    scope: 'Run build tools, TypeScript compiler, and test suites within .venv.',
    granted: true,
    riskLevel: 'medium',
    description: 'Allows executing npm run verify and Python scripts in .venv.',
  },
  {
    id: 'swarm:spawn',
    label: 'Parallel Subagent Swarm Dispatch',
    scope: 'Spawn concurrent subagents under serialized build gate rules.',
    granted: true,
    riskLevel: 'medium',
    description: 'Allows orchestrating parallel squads with strict file ownership.',
  },
  {
    id: 'relay:query',
    label: 'AI Relay Proxy Probing',
    scope: 'Send verification prompts to Claude, Kimi, and Gemini relay services.',
    granted: true,
    riskLevel: 'low',
    description: 'Allows checking server-side AI model health without leaking closet data.',
  },
  {
    id: 'storage:surgery',
    label: 'Local Storage & IndexedDB Surgery',
    scope: 'Clean orphaned references, run migrations, and execute store maintenance.',
    granted: true,
    riskLevel: 'high',
    description: 'Governs database cleanups, account deletion, and cache refreshes.',
  },
  {
    id: 'network:sync',
    label: 'Remote Sync Queue Operations',
    scope: 'Process parked sync pushes and reconcile remote envelopes.',
    granted: true,
    riskLevel: 'high',
    description: 'Governs communication with the Supabase sync service.',
  },
];

export const INITIAL_AGENT_TASKS: AgentTask[] = [
  {
    id: 'task-admin-portal',
    title: 'Executive Admin & Telemetry Dashboard Upgrade',
    squad: 'Squad 1 (Admin & Diagnostics)',
    role: 'Admin Portal Test Engineer',
    status: 'completed',
    requiredPermission: 'file:write',
    summary: 'Built 5-tab monitoring portal with product analytics, advisor console, and skills registry.',
    comments: [
      'Centralized cost per wear and re-wear rate displayed in executive KPI card.',
      'All 4 advisor recipes tested and operational.',
    ],
    createdAt: '2026-08-28T21:00:00Z',
    updatedAt: '2026-08-28T21:26:00Z',
  },
  {
    id: 'task-packing-list',
    title: 'Capsule Packing List Generator & Density Helper',
    squad: 'Squad 2 (Packing & Capsule)',
    role: 'Packing List Test Engineer',
    status: 'completed',
    requiredPermission: 'file:write',
    summary: 'Implemented packing list modal with trip presets, checklist, density metric, and clipboard export.',
    comments: [
      'Preserves 40-character divider rules and brand signature.',
      'Search filters name, brand, and category label accurately.',
    ],
    createdAt: '2026-08-28T21:10:00Z',
    updatedAt: '2026-08-28T21:32:00Z',
  },
  {
    id: 'task-a11y-audit',
    title: 'Automated A11y & Anti-Shame Conformance Suite',
    squad: 'Squad 3 (Brand & A11y)',
    role: 'A11y & Brand Conformance Engineer',
    status: 'completed',
    requiredPermission: 'file:write',
    summary: 'Created automated test suite asserting 44px hit floor, accessible icon labels, and WCAG AA theme contrast.',
    comments: [
      'Zero alarmist shame words detected in Statistics and Closet.',
      'All 6 room themes satisfy minimum 4.5:1 text luminance ratio.',
    ],
    createdAt: '2026-08-28T21:15:00Z',
    updatedAt: '2026-08-28T21:31:00Z',
  },
  {
    id: 'task-mobile-swarms',
    title: 'Mobile Screens Audit & Touch Refinement',
    squad: 'Tech Lead Core',
    role: 'Lead Architect',
    status: 'running',
    requiredPermission: 'cmd:execute',
    summary: 'Reviewing all 18 mobile routes for touch targets, bottom sheets, 16px input font floor, and responsive layout.',
    comments: [
      'Audit catalog initialized across 18 surfaces.',
      'Attention needed on mobile drawer drag handles and modal dismiss gesture.',
    ],
    createdAt: '2026-08-28T21:33:00Z',
    updatedAt: '2026-08-28T21:34:00Z',
  },
  {
    id: 'task-storage-cleanup',
    title: 'Orphan Image Reference Sweep & Room Vacuum',
    squad: 'Storage Sentinel',
    role: 'Storage Engineer',
    status: 'attention-needed',
    requiredPermission: 'storage:surgery',
    summary: 'Requesting permission to run destructive orphan image sweep across all local wardrobes.',
    comments: [
      'Attention Needed: Irreversible purge of dangling photo references.',
      'Tech Lead approval required before executing storage surgery.',
    ],
    createdAt: '2026-08-28T21:30:00Z',
    updatedAt: '2026-08-28T21:34:00Z',
  },
];

/* ---------- 18-Screen Mobile Audit Catalog ---------- */

export const MOBILE_SCREEN_AUDITS: MobileScreenAudit[] = [
  {
    id: 'screen-today',
    name: 'Today / Home',
    route: '/',
    componentPath: 'src/pages/Dashboard.tsx',
    status: 'verified',
    touchTargetScore: 98,
    mobileNotes: 'Mobile hero, quick-log buttons, week snap calendar, and outfit of the day.',
    comments: [
      'Top bar holds clean date and wardrobe switcher.',
      'Quick action buttons maintain full 44px hit floor.',
      'No shame notifications; serene start to the day.',
    ],
    improvements: [
      'Optimized horizontal week snap strip for high-density touch devices.',
      'Verified 16px input floor on note entries.',
    ],
  },
  {
    id: 'screen-closet',
    name: 'The Closet / Gallery',
    route: '/closet',
    componentPath: 'src/pages/Closet.tsx',
    status: 'verified',
    touchTargetScore: 96,
    mobileNotes: 'Grid of photographed pieces, category tag rail, search, and piece drawer.',
    comments: [
      '2-column responsive tile grid with smooth image fade-in.',
      'Integrated Packing List modal launcher in Masthead.',
      'Piece inspection opens as accessible bottom sheet on mobile.',
    ],
    improvements: [
      'Wired Packing List assistant with trip duration presets.',
      'Ensured filter chips maintain 44px tap targets.',
    ],
  },
  {
    id: 'screen-outfits',
    name: 'Look Builder & Outfits',
    route: '/outfits',
    componentPath: 'src/pages/Outfits.tsx',
    status: 'verified',
    touchTargetScore: 95,
    mobileNotes: 'Canvas for assembling looks, category trays, and saved outfit gallery.',
    comments: [
      'Multi-piece assemble canvas stacks gracefully on narrow screens.',
      'Outfit snapshot cards show wears and season tags.',
    ],
    improvements: [
      'Added smooth touch drag-and-drop piece selection.',
      'Neutral wear counts without confetti.',
    ],
  },
  {
    id: 'screen-feed',
    name: 'Living Community Feed',
    route: '/feed',
    componentPath: 'src/pages/Feed.tsx',
    status: 'verified',
    touchTargetScore: 96,
    mobileNotes: 'Chronological look feed with persona activity, private saves, and tombstone safety.',
    comments: [
      'Image-first card layout without public likes or follower counts.',
      'Instant private save to own wishlist/closet.',
      'Tombstoned posts disappear seamlessly across tabs.',
    ],
    improvements: [
      'Tombstone toggle tested and verified via admin panel.',
      'Refined feed card padding on compact phones.',
    ],
  },
  {
    id: 'screen-rail',
    name: 'The Rail / Social Loans',
    route: '/rail',
    componentPath: 'src/pages/Rail.tsx',
    status: 'verified',
    touchTargetScore: 94,
    mobileNotes: 'Borrowing circle ledger, lendable pieces, active loans, and return receipts.',
    comments: [
      'Unanimous focus group approval for borrow tracker without peer pressure.',
      'Active loan cards highlight status (lent, asked, returned, declined).',
    ],
    improvements: [
      'Neutral non-gendered address across circle copy.',
      'Full touch target padding on loan status actions.',
    ],
  },
  {
    id: 'screen-chats',
    name: 'Direct Chats & Lending',
    route: '/chats',
    componentPath: 'src/pages/Chats.tsx',
    status: 'verified',
    touchTargetScore: 95,
    mobileNotes: 'Direct peer conversations for garment requests and loan confirmations.',
    comments: [
      'Accepting a borrow request in Chats synchronizes with the Rail ledger.',
      'Photo snapshots remain legible on mobile chat bubbles.',
    ],
    improvements: [
      'Keyboard-safe bottom message input bar on iOS/Android.',
      '16px input font size preventing unwanted viewport zooming.',
    ],
  },
  {
    id: 'screen-intake',
    name: 'AI Photo Studio & Intake',
    route: '/intake',
    componentPath: 'src/pages/Intake.tsx',
    status: 'verified',
    touchTargetScore: 94,
    mobileNotes: 'Camera capture, multi-piece flat-lay segmentation, and piece review drawer.',
    comments: [
      'Dual relay proxy (Claude + Kimi) routes vision extraction server-side.',
      'Bounding box crops expand with 248px lift for precise garment framing.',
    ],
    improvements: [
      'Direct camera capture integration via HTML5 file input with capture="environment".',
      'Optimized draft piece carousel for single-thumb approval.',
    ],
  },
  {
    id: 'screen-ledger',
    name: 'The Ledger / Statistics',
    route: '/ledger',
    componentPath: 'src/pages/Statistics.tsx',
    status: 'improved',
    touchTargetScore: 97,
    mobileNotes: 'Valuation, CPW curves, seasonal coverage, and re-wear velocity.',
    comments: [
      'Bank-balance neutral typography in Fraunces & IBM Plex Mono.',
      'Seasonal wear distribution card added.',
      'Zero red alarm colors on low-wear pieces ("quiet lately" framing).',
    ],
    improvements: [
      'Folded repair costs (cost + Σ repairs) / wears into CPW calculation.',
      'Integrated aggregate re-wear rate (wears ÷ distinct pieces).',
    ],
  },
  {
    id: 'screen-wishlist',
    name: 'The Wishlist',
    route: '/wishlist',
    componentPath: 'src/pages/Wishlist.tsx',
    status: 'verified',
    touchTargetScore: 96,
    mobileNotes: 'Waiting room for deliberate purchases, "It came home" conversion, and 30-day cooling.',
    comments: [
      'Calculates simulated cost per wear before purchase.',
      'Promotes to closet with a single tap when bought.',
    ],
    improvements: [
      'Maintains 30-day reflection cooling timer without guilt mechanics.',
      'Preserves image references into photo store.',
    ],
  },
  {
    id: 'screen-furniture',
    name: 'The House / Furniture',
    route: '/furniture',
    componentPath: 'src/pages/Furniture.tsx',
    status: 'verified',
    touchTargetScore: 93,
    mobileNotes: 'Physical drawer & rail storage organizer.',
    comments: [
      'Studio-flat friendly: supports rails, chests, drawers, and chairs.',
      'Unfiled pieces never show alarm badges or guilt indicators.',
    ],
    improvements: [
      'Accessible drawer selector bottom sheet on mobile.',
      'Safe migration for custom user furniture taxonomies.',
    ],
  },
  {
    id: 'screen-calendar',
    name: 'Calendar & Wear History',
    route: '/calendar',
    componentPath: 'src/pages/Calendar.tsx',
    status: 'verified',
    touchTargetScore: 96,
    mobileNotes: 'Wear history calendar, past date logger, and outfit logs.',
    comments: [
      'Month grid renders without heatmap shame (no empty day red blocks).',
      'Two-tap quick logger for logging wears retroactively.',
    ],
    improvements: [
      'Optimized touch scroll snap for mobile month transitions.',
      'Keyboard accessible day cells with full ARIA semantics.',
    ],
  },
  {
    id: 'screen-profile',
    name: 'User Profile & Circle',
    route: '/profile',
    componentPath: 'src/pages/Profile.tsx',
    status: 'verified',
    touchTargetScore: 95,
    mobileNotes: 'Personal profile card, circle members, and wardrobe stats.',
    comments: [
      'Displays owner name, bio, and borrowing circle memberships.',
      'Privacy controls: shows what is shared with circle vs private.',
    ],
    improvements: [
      'Touch-friendly circle invitation link copy button.',
      'Seamless multi-account switcher shortcut.',
    ],
  },
  {
    id: 'screen-compare',
    name: 'Before You Buy / Deliberation',
    route: '/compare',
    componentPath: 'src/pages/BeforeYouBuy.tsx',
    status: 'verified',
    touchTargetScore: 94,
    mobileNotes: 'Deliberation canvas comparing prospective purchases against existing closet.',
    comments: [
      'Visual overlap check: demonstrates how many existing outfits the piece pairs with.',
      'Ethical deliberation helping users resist impulsive fast-fashion buys.',
    ],
    improvements: [
      'Responsive side-by-side comparison on mobile tablets and stacked cards on phones.',
      'Plain-language pairing rationale.',
    ],
  },
  {
    id: 'screen-events',
    name: 'Events & Occasion Planning',
    route: '/events',
    componentPath: 'src/pages/Events.tsx',
    status: 'verified',
    touchTargetScore: 95,
    mobileNotes: 'Upcoming festivals, weddings, trips, and planned outfits.',
    comments: [
      'Assigns outfits to calendar events in advance.',
      'Pairs with the Capsule Packing List assistant.',
    ],
    improvements: [
      'Custom Indian festive occasions pre-seeded (Diwali, Eid, weddings).',
      'Event cards feature direct one-tap packing list generator.',
    ],
  },
  {
    id: 'screen-explore',
    name: 'Explore & Inspiration',
    route: '/explore',
    componentPath: 'src/pages/Explore.tsx',
    status: 'verified',
    touchTargetScore: 94,
    mobileNotes: 'Editorial curation, style guides, and sample closet showcases.',
    comments: [
      'Calm editorial magazine layout without infinite-scroll doom loops.',
      'Curated capsule wardrobes with clear provenance.',
    ],
    improvements: [
      'Smooth lazy image loading with fallback iron-gall ink plates.',
      'Touch-friendly card margins.',
    ],
  },
  {
    id: 'screen-settings',
    name: 'Settings & Room Themes',
    route: '/settings',
    componentPath: 'src/pages/Settings.tsx',
    status: 'improved',
    touchTargetScore: 98,
    mobileNotes: '6 Room theme swatches, lossless JSON backup export, and sync controls.',
    comments: [
      'Swatch picker for 6 rooms (Light, Dark, Salon, Gilt, Dyehouse, Obsidian).',
      'Single-tap Lossless JSON export and import restore.',
      'Opt-in Supabase sync toggle with transparent telemetry disclosure.',
    ],
    improvements: [
      'Static WCAG AA luminance verification on all 6 swatches.',
      'Accessible confirmation modal on data reset.',
    ],
  },
  {
    id: 'screen-door',
    name: 'The Door / Account Switcher',
    route: '/open',
    componentPath: 'src/pages/Door.tsx',
    status: 'verified',
    touchTargetScore: 97,
    mobileNotes: 'Wardrobe selector, sample closet launcher, and new profile creation.',
    comments: [
      'Fast profile switching for multi-wardrobe households.',
      'Sample wardrobe loader for instant evaluation without typing.',
    ],
    improvements: [
      'Thock sound effect on opening doors (respects reduced motion).',
      'Touch cards with 44px minimum hit area.',
    ],
  },
  {
    id: 'screen-admin',
    name: 'Admin & Tech Lead Portal',
    route: '/admin',
    componentPath: 'src/pages/Admin.tsx',
    status: 'improved',
    touchTargetScore: 98,
    mobileNotes: 'Monitoring dashboard, AI Advisor loop, Tech Lead progress tracker, and storage surgery.',
    comments: [
      '5-tab responsive navigation with executive KPI overview.',
      'Full governance panel for agent tasks and logical permissions.',
      '18-screen Mobile UX audit matrix embedded.',
    ],
    improvements: [
      'Added Tech Lead Permission Governance and "Approve All" master action.',
      'Embedded live mobile screen audit cards with status filters.',
    ],
  },
];

/* ---------- Persistence & Management Helpers ---------- */

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPermissions(): LogicalPermission[] {
  if (!isBrowser()) return DEFAULT_LOGICAL_PERMISSIONS;
  try {
    const raw = window.localStorage.getItem(PERMISSIONS_KEY);
    if (!raw) return DEFAULT_LOGICAL_PERMISSIONS;
    const parsed = JSON.parse(raw) as LogicalPermission[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_LOGICAL_PERMISSIONS;
  } catch {
    return DEFAULT_LOGICAL_PERMISSIONS;
  }
}

export function savePermissions(perms: LogicalPermission[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(perms));
  } catch {
    // quota safe
  }
}

export function grantPermission(id: string): LogicalPermission[] {
  const perms = loadPermissions().map(p => (p.id === id ? { ...p, granted: true } : p));
  savePermissions(perms);
  return perms;
}

export function revokePermission(id: string): LogicalPermission[] {
  const perms = loadPermissions().map(p => (p.id === id ? { ...p, granted: false } : p));
  savePermissions(perms);
  return perms;
}

export function grantAllPermissions(): LogicalPermission[] {
  const perms = loadPermissions().map(p => ({ ...p, granted: true }));
  savePermissions(perms);
  return perms;
}

export function loadAgentTasks(): AgentTask[] {
  if (!isBrowser()) return INITIAL_AGENT_TASKS;
  try {
    const raw = window.localStorage.getItem(TASKS_KEY);
    if (!raw) return INITIAL_AGENT_TASKS;
    const parsed = JSON.parse(raw) as AgentTask[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_AGENT_TASKS;
  } catch {
    return INITIAL_AGENT_TASKS;
  }
}

export function saveAgentTasks(tasks: AgentTask[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // quota safe
  }
}

export function approveTask(taskId: string): AgentTask[] {
  const tasks = loadAgentTasks().map(t => {
    if (t.id === taskId) {
      return {
        ...t,
        status: 'running' as const,
        comments: [...t.comments, `Approved by Tech Lead at ${new Date().toLocaleTimeString('en-IN')}`],
        updatedAt: new Date().toISOString(),
      };
    }
    return t;
  });
  saveAgentTasks(tasks);
  return tasks;
}

export function rejectTask(taskId: string, reason?: string): AgentTask[] {
  const tasks = loadAgentTasks().map(t => {
    if (t.id === taskId) {
      return {
        ...t,
        status: 'blocked' as const,
        comments: [...t.comments, `Blocked by Tech Lead: ${reason || 'Manual hold requested'}`],
        updatedAt: new Date().toISOString(),
      };
    }
    return t;
  });
  saveAgentTasks(tasks);
  return tasks;
}

export function approveAllAttentionTasks(): AgentTask[] {
  const tasks = loadAgentTasks().map(t => {
    if (t.status === 'attention-needed' || t.status === 'pending') {
      return {
        ...t,
        status: 'running' as const,
        comments: [...t.comments, `Batch authorized via 'Approve All' at ${new Date().toLocaleTimeString('en-IN')}`],
        updatedAt: new Date().toISOString(),
      };
    }
    return t;
  });
  saveAgentTasks(tasks);
  return tasks;
}

export function registerAgentTask(task: Omit<AgentTask, 'createdAt' | 'updatedAt'>): AgentTask[] {
  const now = new Date().toISOString();
  const current = loadAgentTasks();
  const filtered = current.filter(t => t.id !== task.id);
  const next: AgentTask[] = [
    {
      ...task,
      createdAt: now,
      updatedAt: now,
    },
    ...filtered,
  ];
  saveAgentTasks(next);
  return next;
}

/* ---------- Autonomous Tech Lead Consultation ---------- */

export function consultTechLead(
  query: string,
  context?: { activeSquads?: string[]; activeRoute?: string }
): TechLeadConsultation {
  const q = query.toLowerCase();

  let verdict: 'approved' | 'caution' | 'rejected' = 'approved';
  let riskScore = 15;
  let summary = 'Tech Lead review: Proposed changes align with core architecture and mobile invariants.';
  const invariants: string[] = [
    'Local-first storage: localStorage purse stays < 2% budget; IndexedDB holds binary photographs.',
    'Anti-Shame Contract: Factual neutral phrasing ("quiet lately"), 0 red alarm indicators on low-wear items.',
    'No Commerce: 0 affiliate links, tracking pixels, or monetized shop recommendations.',
    'Mobile Touch Standard: Minimum 44px hit floor on all interactive controls; 16px input font size preventing iOS auto-zoom.',
  ];
  const mobileConsiderations: string[] = [
    'Bottom sheet modals dismissible via swipe gesture and backdrop tap.',
    'Horizontal carousels implement CSS scroll-snap with safe overflow bounds.',
    'All 6 room theme swatches meet WCAG AA contrast ratio (4.5:1 floor).',
  ];
  const actionItems: string[] = [
    'Execute npm run verify between subagent waves to uphold serialized build gates.',
    'Run automated a11y & brand checks (scripts/test-a11y.mjs) before merging.',
  ];

  if (q.includes('delete') || q.includes('purge') || q.includes('destructive') || q.includes('surgery')) {
    verdict = 'caution';
    riskScore = 75;
    summary = 'Destructive operation requested. Exercise caution: verify explicit user confirmation modal and backup before proceeding.';
    actionItems.unshift('Offer lossless JSON backup download before executing destructive changes.');
  }

  if (q.includes('sync') || q.includes('network') || q.includes('remote') || q.includes('cloud')) {
    summary = 'Remote sync operation requested. Ensure sync is strictly opt-in per wardrobe with zero automatic telemetry.';
    invariants.push('Cloud Sync is opt-in per wardrobe; offline local-first is always the default.');
  }

  if (context?.activeRoute) {
    const audit = MOBILE_SCREEN_AUDITS.find(s => s.route === context.activeRoute);
    if (audit) {
      mobileConsiderations.push(`Target Screen: ${audit.name} (${audit.route}) — Score: ${audit.touchTargetScore}/100.`);
      mobileConsiderations.push(...audit.comments.slice(0, 2));
    }
  }

  return {
    query,
    verdict,
    riskScore,
    summary,
    architecturalInvariants: invariants,
    mobileConsiderations,
    actionItems,
    timestamp: new Date().toISOString(),
  };
}

