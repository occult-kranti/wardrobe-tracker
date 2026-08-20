/**
 * check-alias-parity.mjs — the resolved-path diff between vite and esbuild.
 *
 * docs/33, Wave 3: the proof that the shared-package lift holds is "a
 * resolved-path diff between vite and esbuild, not an exit code". Both
 * resolvers consume one table, packages/shared/aliases.mjs, and this check
 * refuses to take that on faith. For every module in the shared package it
 * resolves the specifier through vite itself (the real config, a real
 * plugin container) and through esbuild itself (a real bundle, resolution
 * read back from the metafile), prints the two absolute paths side by side,
 * and fails on any divergence: a path that differs, a specifier one
 * resolver can place and the other cannot, an esbuild call site in scripts/
 * that stopped consuming the shared table, or a module set that is not
 * exactly the six the lift moved.
 *
 * --red-proof points the esbuild leg at a decoy copy of the package and
 * requires the diff to catch every module diverging. It runs in the verify
 * chain, so the check cannot quietly rot into a green stamp
 * (precedent: scripts/check-native-storage.mjs).
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const RED_PROOF = process.argv.includes('--red-proof');
const WIN = process.platform === 'win32';
const canon = (p) => {
  const r = path.resolve(p).replace(/\\/g, '/');
  return WIN ? r.toLowerCase() : r;
};
const shown = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) fail++;
};

// ---- the one table, and the module set pinned to exactly the six ----
const { sharedAliases, SHARED_PACKAGE, packageRoot } = await import(
  pathToFileURL(path.join(ROOT, 'packages/shared/aliases.mjs')).href
);
// The six lifted modules plus the two shell modules of docs/42 (flags, nav).
// Sorted — the check compares element-wise against a sorted directory read.
const EXPECTED_MODULES = ['cost', 'dates', 'flags', 'intake', 'migrate', 'nav', 'similarity', 'types'];
const actualModules = readdirSync(packageRoot)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.endsWith('.d.mts'))
  .map((f) => f.replace(/\.ts$/, ''))
  .sort();
check(
  'the shared package holds exactly the modules the manifest names',
  actualModules.length === EXPECTED_MODULES.length &&
    actualModules.every((m, i) => m === EXPECTED_MODULES[i]),
  `found [${actualModules.join(', ')}]`
);
const specifiers = EXPECTED_MODULES.map((m) => `${SHARED_PACKAGE}/${m}`);

// ---- vite's side: the specifier resolved by vite itself ----
const { createServer } = await import('vite');
const server = await createServer({
  configFile: path.join(ROOT, 'vite.config.ts'),
  logLevel: 'silent',
  server: { middlewareMode: true },
});
const viteResolved = new Map();
try {
  const container =
    server.environments?.client?.pluginContainer ?? server.pluginContainer;
  const importer = path.join(ROOT, 'src', 'main.tsx').replace(/\\/g, '/');
  for (const spec of specifiers) {
    const r = await container.resolveId(spec, importer);
    if (r && r.id && !r.external) viteResolved.set(spec, r.id.split('?')[0]);
  }
  // The resolved config must know exactly the shared aliases — no extras
  // minted outside the table, none of the table's keys dropped.
  const tableKeys = Object.keys(sharedAliases()).sort();
  const viteKeys = server.config.resolve.alias
    .map((e) => e.find)
    .filter((f) => typeof f === 'string' && f.startsWith('@almari'))
    .sort();
  check(
    'vite.config.ts carries exactly the shared alias table',
    tableKeys.length === viteKeys.length && tableKeys.every((k, i) => k === viteKeys[i]),
    `table [${tableKeys.join(', ')}] vs vite [${viteKeys.join(', ')}]`
  );
} finally {
  await server.close();
}

// ---- esbuild's side: a real bundle, resolution read from the metafile ----
// Under --red-proof the table is swapped for a decoy copy of the package;
// the diff below must then catch every module diverging.
let decoyDir = null;
let esbuildTable = sharedAliases();
if (RED_PROOF) {
  decoyDir = mkdtempSync(path.join(tmpdir(), 'alias-red-proof-'));
  for (const m of EXPECTED_MODULES) {
    writeFileSync(path.join(decoyDir, `${m}.ts`), 'export {};\n');
  }
  esbuildTable = { [SHARED_PACKAGE]: decoyDir };
}
const { build } = await import('esbuild');
const probeName = 'alias-parity-probe.mjs';
const esbuildResolved = new Map();
try {
  const bundled = await build({
    stdin: {
      contents: specifiers.map((s) => `import ${JSON.stringify(s)};`).join('\n'),
      resolveDir: ROOT,
      sourcefile: probeName,
      loader: 'js',
    },
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    logLevel: 'silent',
    absWorkingDir: ROOT,
    alias: esbuildTable,
  });
  const entry = Object.entries(bundled.metafile.inputs).find(([k]) =>
    k.includes(probeName)
  );
  for (const [i, imp] of (entry ? entry[1].imports : []).entries()) {
    const spec = imp.original ?? specifiers[i];
    if (!imp.external) esbuildResolved.set(spec, path.resolve(ROOT, imp.path));
  }
} catch (err) {
  check('esbuild resolved the probe bundle', false, String((err && err.message) || err));
} finally {
  if (decoyDir) rmSync(decoyDir, { recursive: true, force: true });
}

// ---- the diff itself ----
console.log('');
console.log(`resolved-path diff, vite vs esbuild${RED_PROOF ? ' (red-proof: esbuild leg decoyed)' : ''}:`);
let diverged = 0;
for (const spec of specifiers) {
  const v = viteResolved.get(spec);
  const e = esbuildResolved.get(spec);
  const ok = v !== undefined && e !== undefined && canon(v) === canon(e);
  if (!ok) diverged++;
  console.log(`  ${ok ? 'OK       ' : 'DIVERGED '} ${spec}`);
  console.log(`             vite    -> ${v === undefined ? '(unresolved)' : shown(v)}`);
  console.log(`             esbuild -> ${e === undefined ? '(unresolved)' : shown(e)}`);
}
console.log('');

if (RED_PROOF) {
  check(
    'red-proof: a decoyed esbuild leg is caught on every module',
    diverged === specifiers.length,
    `${diverged}/${specifiers.length} divergences detected`
  );
  console.log('');
  if (fail) {
    console.log('alias parity red-proof FAILED — the check cannot be trusted to catch divergence');
    process.exit(1);
  }
  console.log('alias parity red-proof passed: divergence is caught, loudly');
  process.exit(0);
}
fail += diverged;

// ---- every esbuild call site consumes the shared table ----
const offenders = [];
const handRolled = [];
let esbuildScripts = 0;
for (const f of readdirSync(path.join(ROOT, 'scripts'))) {
  if (!f.endsWith('.mjs') || f === 'check-alias-parity.mjs') continue;
  const text = readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
  if (!/from ['"]esbuild['"]/.test(text)) continue;
  esbuildScripts++;
  const buildCalls = (text.match(/\bbuild\(\{/g) ?? []).length;
  const aliased = (text.match(/alias:\s*sharedAliases\(\)/g) ?? []).length;
  if (buildCalls === 0 || aliased < buildCalls) {
    offenders.push(`${f}: ${aliased} of ${buildCalls} build calls aliased`);
  }
  if (/['"]@almari[^'"]*['"]\s*:/.test(text)) handRolled.push(f);
}
check('the audit found the esbuild call sites', esbuildScripts > 0, `${esbuildScripts} scripts import esbuild`);
check('every esbuild call site consumes the shared alias table', offenders.length === 0, offenders.join('; '));
check('no script hand-rolls an @almari alias outside the shared table', handRolled.length === 0, handRolled.join('; '));

// ---- tsconfig paths point at the same directory (the editor's leg) ----
const tsconfigLeg = (file, baseDir) => {
  const text = readFileSync(path.join(ROOT, file), 'utf8');
  const m = text.match(/"@almari\/shared\/\*"\s*:\s*\[\s*"([^"]+)"/);
  check(
    `${file} paths target the shared package`,
    !!m && canon(path.resolve(baseDir, m[1].replace(/\/\*$/, ''))) === canon(packageRoot),
    m ? m[1] : 'no @almari/shared/* mapping found'
  );
};
tsconfigLeg('tsconfig.app.json', ROOT);
tsconfigLeg(path.join('app', 'tsconfig.json'), path.join(ROOT, 'app'));

console.log('');
if (fail) {
  console.log(`alias parity: ${fail} failure(s) — the resolvers do not agree`);
  process.exit(1);
}
console.log('alias parity: vite and esbuild resolve every shared specifier to the same file');
