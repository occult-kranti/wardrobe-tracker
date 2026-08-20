#!/usr/bin/env node
/**
 * What the phone is allowed to write down.
 *
 * The web app keeps everything in localStorage, which is scoped to an origin
 * and is not in anybody's cloud backup. A phone is a different building. Three
 * of its doors are cheap to leave open and expensive to notice:
 *
 *   1. AsyncStorage is a PLAINTEXT file in the app's sandbox. On a rooted or
 *      jailbroken phone it is a `cat`. On a stock phone with Android's
 *      auto-backup on it is a file Google keeps a copy of. It is the right
 *      place for a wardrobe and the wrong place for a key, a token, or a
 *      session. src/lib/anthropic.ts stores the provider key under
 *      'toile-key'; on the web that is localStorage and that is the deal.
 *      On the phone the same string belongs in the keychain.
 *   2. supabase-js on native DEFAULTS to AsyncStorage for the auth session if
 *      you do not hand it a `storage` adapter — so the refresh token, which is
 *      the account, lands in that same plaintext file. The fix is one option
 *      and it is easy to forget, which is why it is checked rather than
 *      remembered.
 *   3. Android's auto-backup, on by default, copies the app's data directory
 *      into the user's Google account. Without `android.allowBackup: false` in
 *      app.json, a wardrobe document can be lifted off a phone by anybody who
 *      can restore that backup onto another device. The whole product promise
 *      is "local-first, your closet is yours"; a silent cloud copy is that
 *      promise broken without a sentence anywhere admitting it.
 *
 * THIS GUARD PASSES TRIVIALLY TODAY, ON PURPOSE. app/ is an Expo scaffold with
 * no src/ tree: nothing calls AsyncStorage, nothing builds a Supabase client,
 * and nothing is stored that a backup could lift. Every rule below is written
 * to arm itself the moment the file it polices exists, so the first commit
 * that adds app/src/ meets a guard that was already waiting.
 *
 * ONE RULE IS DELIBERATELY A WARNING TODAY, AND YOU SHOULD KNOW WHY. Rule 3
 * (allowBackup) polices app/app.json, which exists NOW and does NOT declare
 * it. That is a real gap and it is reported on every run — but it is reported
 * as WARN until app/ has a source tree, because today the app stores nothing
 * and there is nothing in the backup to take. The instant app/src/ or app/app/
 * exists the same rule is a hard FAIL. This is not the check being softened to
 * go green; it is the check refusing to cry wolf about an empty directory
 * while still naming the exact line somebody has to add.
 *
 * Usage:
 *   node scripts/check-native-storage.mjs              check app/
 *   node scripts/check-native-storage.mjs --root DIR   check somewhere else
 *   node scripts/check-native-storage.mjs --red-proof  prove the guard bites
 */
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative, sep } from 'path';

const APP_ROOT = fileURLToPath(new URL('../app', import.meta.url));

/**
 * Storage key names that must never reach AsyncStorage.
 *
 * Two shapes. `exact` is a name this repo actually uses — 'toile-key' is the
 * constant in src/lib/anthropic.ts, and a native port that copies that line
 * across is the most likely way this rule gets broken. `pattern` catches the
 * name nobody has invented yet, because the next secret will not be called
 * what this list expects.
 */
const SECRET_KEYS = {
  exact: [
    ['toile-key', "the AI provider key — src/lib/anthropic.ts's own constant, copied to the phone"],
    ['toile-ai', 'the provider override block, which carries a key alongside the model'],
  ],
  pattern: [
    [/(^|[-_.])api[-_.]?key/i, 'an API key'],
    [/(^|[-_.])secret/i, 'something the name itself calls a secret'],
    [/token/i, 'a token — an access or refresh token IS the account'],
    [/password|passphrase|passcode/i, 'a password'],
    [/credential/i, 'a credential'],
    [/(^|[-_.])(auth|session)([-_.]|$)/i, 'an auth session, which supabase-js will refresh into an account'],
    [/(^|[-_.])jwt([-_.]|$)/i, 'a JWT'],
    [/private[-_.]?key|signing[-_.]?key|encryption[-_.]?key/i, 'a private or signing key'],
    [/(^|[-_.])key$/i, 'a key, by its own name'],
  ],
  /**
   * Names that match a pattern above and are provably innocent. Empty today.
   * Adding to this list is a decision that needs a sentence next to it saying
   * what the value is and why a plaintext file is fine for it — never a
   * shortcut to make a red line go away.
   */
  allowed: [],
};

/** Source files worth reading. node_modules is somebody else's problem. */
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.expo', '.git', 'android', 'ios', 'dist', 'build']);

function sourceFiles(root) {
  const found = [];
  const walk = dir => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(entry)) walk(full);
      } else if (SOURCE_EXT.has(entry.slice(entry.lastIndexOf('.')))) {
        found.push(full);
      }
    }
  };
  walk(root);
  return found;
}

/** Is there a source tree here yet — anything that could store anything? */
function hasSourceTree(root) {
  return existsSync(join(root, 'src')) || existsSync(join(root, 'app')) || existsSync(join(root, 'lib'));
}

/**
 * Every string literal handed to a .setItem( call, with the line it sits on.
 * Deliberately shallow: it matches `setItem('x'` on any receiver rather than
 * trying to prove the receiver is AsyncStorage, because a wrapper called
 * `store.setItem` backed by AsyncStorage is the same leak with better manners.
 */
function setItemKeys(source) {
  const keys = [];
  const re = /\.setItem\s*\(\s*(['"`])([^'"`]*)\1/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const line = source.slice(0, m.index).split('\n').length;
    keys.push({ key: m[2], line });
  }
  return keys;
}

function whySecret(key) {
  if (SECRET_KEYS.allowed.includes(key)) return null;
  for (const [name, why] of SECRET_KEYS.exact) if (key === name) return why;
  for (const [re, why] of SECRET_KEYS.pattern) if (re.test(key)) return why;
  return null;
}

/* ---------- the rules ---------- */
function runChecks(root, { quiet = false } = {}) {
  let fail = 0;
  let warn = 0;
  const failures = [];
  const check = (label, ok, detail = '') => {
    if (!quiet || !ok) {
      console.log(ok ? 'PASS' : 'FAIL', '-', label, detail !== '' && detail !== undefined ? `(${detail})` : '');
    }
    if (!ok) { fail++; failures.push(label); }
  };
  const note = text => { if (!quiet) console.log('WARN -', text); warn++; };

  const files = sourceFiles(root);
  const armed = hasSourceTree(root);
  const rel = f => relative(root, f).split(sep).join('/');

  /* --- rule 1: nothing secret in the plaintext file --- */
  const leaks = [];
  for (const file of files) {
    let source;
    try { source = readFileSync(file, 'utf8'); } catch { continue; }
    // Only worth reading if the file is anywhere near AsyncStorage. A
    // SecureStore.setItemAsync call is the CORRECT destination and must not be
    // reported as a leak.
    const usesAsyncStorage = /async-storage|AsyncStorage/.test(source);
    if (!usesAsyncStorage) continue;
    for (const { key, line } of setItemKeys(source)) {
      const why = whySecret(key);
      if (why) leaks.push({ file: rel(file), line, key, why });
    }
  }
  check(
    'no AsyncStorage key names a secret',
    leaks.length === 0,
    leaks.length
      ? `${leaks[0].file}:${leaks[0].line} writes "${leaks[0].key}" — that is ${leaks[0].why}. ` +
        'AsyncStorage is a plaintext file in the app sandbox and is copied by device backup. ' +
        'Put this in expo-secure-store (the keychain / Android Keystore) instead.' +
        (leaks.length > 1 ? ` And ${leaks.length - 1} more.` : '')
      : `${files.length} file(s) read`
  );

  /* --- rule 2: the Supabase session lives in the keychain, not the sandbox --- */
  const clients = files.filter(f => {
    try { return /createClient\s*\(/.test(readFileSync(f, 'utf8')); } catch { return false; }
  });
  if (clients.length === 0) {
    if (!quiet) console.log(`PASS - no Supabase client in ${rel(root) || 'app/'} yet, so nothing to misconfigure (rule arms with the first createClient call)`);
  } else {
    for (const file of clients) {
      const source = readFileSync(file, 'utf8');
      const importsSecureStore = /from\s+['"]expo-secure-store['"]/.test(source);
      const passesStorage = /\bstorage\s*:/.test(source);
      // The adapter has to be wired to SecureStore, not merely imported next
      // to the client — the two together are the whole rule.
      check(
        `${rel(file)} hands supabase-js a SecureStore-backed storage adapter`,
        importsSecureStore && passesStorage,
        !importsSecureStore
          ? 'no expo-secure-store import. supabase-js on native DEFAULTS to AsyncStorage for the ' +
            'auth session, so the refresh token — which IS the account — would sit in a plaintext ' +
            'file that Android auto-backup copies to Google. Import expo-secure-store and pass it ' +
            'as auth.storage.'
          : 'expo-secure-store is imported but no `storage:` option is passed to createClient, so ' +
            'supabase-js is still defaulting to AsyncStorage for the session. The import does ' +
            'nothing until it is wired to auth.storage.'
      );
    }
  }

  /* --- rule 3: a device backup must not be able to lift the wardrobe --- */
  const appJsonPath = join(root, 'app.json');
  if (!existsSync(appJsonPath)) {
    check('app.json exists', false, `no ${rel(appJsonPath)} — an Expo app without one cannot declare anything`);
  } else {
    let config = null;
    try { config = JSON.parse(readFileSync(appJsonPath, 'utf8')); } catch { /* reported below */ }
    const declared = config?.expo?.android?.allowBackup;
    const explanation =
      'app.json does not declare expo.android.allowBackup: false. Android auto-backup is ON by ' +
      'default and copies the app data directory into the user\'s Google account, so a wardrobe ' +
      'document can be restored onto a phone that is not theirs. "Local-first, your closet is ' +
      'yours" is not true while a silent cloud copy exists. Add "allowBackup": false under ' +
      'expo.android in app/app.json.';
    if (declared === false) {
      check('app.json declares android.allowBackup false', true, 'a device backup cannot lift the wardrobe');
    } else if (armed) {
      check('app.json declares android.allowBackup false', false, `found ${JSON.stringify(declared)} — ${explanation}`);
    } else {
      // Not yet a failure and not yet forgotten. See the header for why.
      note(`${rel(appJsonPath)}: ${explanation} Reported as a warning only while app/ has no source tree — nothing is stored yet. This becomes a FAIL on the commit that adds app/src/.`);
    }
  }

  return { fail, warn, failures };
}

/* ---------- the red-proof ----------
   Three fabricated trees, each breaking exactly one rule, built in the system
   temp directory. Nothing is written inside app/ — this repo is being edited by
   several people at once and a fixture dropped into somebody else's directory
   is a worse bug than the one it proves. Each scenario passes only if the
   guard fails and names the right rule. */
const FIXTURES = [
  {
    name: 'a secret key written to AsyncStorage',
    expect: 'no AsyncStorage key names a secret',
    files: {
      'app.json': JSON.stringify({ expo: { android: { allowBackup: false } } }, null, 2),
      'src/keys.ts': [
        "import AsyncStorage from '@react-native-async-storage/async-storage';",
        "export async function save(key: string) {",
        "  await AsyncStorage.setItem('toile-key', key);",
        '}',
        '',
      ].join('\n'),
    },
  },
  {
    name: 'a Supabase client with no SecureStore adapter',
    expect: 'hands supabase-js a SecureStore-backed storage adapter',
    files: {
      'app.json': JSON.stringify({ expo: { android: { allowBackup: false } } }, null, 2),
      'src/supabase.ts': [
        "import { createClient } from '@supabase/supabase-js';",
        "export const supabase = createClient('https://x.supabase.co', 'anon', {",
        '  auth: { persistSession: true, autoRefreshToken: true },',
        '});',
        '',
      ].join('\n'),
    },
  },
  {
    name: 'an app.json that lets Android back the wardrobe up, with a source tree present',
    expect: 'app.json declares android.allowBackup false',
    files: {
      'app.json': JSON.stringify({ expo: { name: 'Almari', android: { adaptiveIcon: {} } } }, null, 2),
      'src/store.ts': "export const nothing = 1;\n",
    },
  },
  {
    name: 'expo-secure-store imported but never wired to auth.storage',
    expect: 'hands supabase-js a SecureStore-backed storage adapter',
    files: {
      'app.json': JSON.stringify({ expo: { android: { allowBackup: false } } }, null, 2),
      'src/supabase.ts': [
        "import { createClient } from '@supabase/supabase-js';",
        "import * as SecureStore from 'expo-secure-store';",
        "void SecureStore;",
        "export const supabase = createClient('https://x.supabase.co', 'anon', {",
        '  auth: { persistSession: true },',
        '});',
        '',
      ].join('\n'),
    },
  },
];

function runRedProof() {
  let bad = 0;
  for (const fixture of FIXTURES) {
    const root = mkdtempSync(join(tmpdir(), 'native-storage-'));
    for (const [path, source] of Object.entries(fixture.files)) {
      const full = join(root, path);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, source);
    }
    console.log(`\n=== fixture: ${fixture.name} ===`);
    const { fail, failures } = runChecks(root, { quiet: true });
    const named = failures.some(f => f.includes(fixture.expect));
    for (const f of failures) console.log('    caught:', f);
    const ok = fail > 0 && named;
    console.log(ok
      ? `RED-PROOF OK - the guard failed and named "${fixture.expect}"`
      : `RED-PROOF FAILED - ${fail} failure(s), none naming "${fixture.expect}"`);
    if (!ok) bad++;
    rmSync(root, { recursive: true, force: true });
  }
  console.log(bad === 0 ? '\nALL RED-PROOFS PASSED' : `\n${bad} RED-PROOF(S) FAILED`);
  process.exit(bad ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.includes('--red-proof')) {
  runRedProof();
} else {
  const root = argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : APP_ROOT;
  if (!existsSync(root)) {
    // No native app at all is a legitimate state for this repo's history, and
    // failing on it would make the guard a nuisance rather than a guard.
    console.log(`PASS - no ${root} yet, nothing to check`);
    console.log('\nALL NATIVE STORAGE CHECKS PASSED');
    process.exit(0);
  }
  const { fail, warn } = runChecks(root);
  if (warn > 0) {
    console.log(`\n${warn} warning(s) above are gaps that are not yet failures. They arm themselves`);
    console.log('when app/ grows a source tree. Fixing one early costs nothing.');
  }
  console.log(fail === 0 ? '\nALL NATIVE STORAGE CHECKS PASSED' : `\n${fail} NATIVE STORAGE CHECKS FAILED`);
  process.exit(fail ? 1 : 0);
}
