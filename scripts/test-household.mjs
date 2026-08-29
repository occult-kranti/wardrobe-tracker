#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sharedAliases } from '../packages/shared/aliases.mjs';
import crypto from 'node:crypto';

if (!global.crypto) {
  global.crypto = crypto;
}

async function run() {
  const dir = mkdtempSync(join(tmpdir(), 'test-household-'));
  let fail = 0;
  
  const check = (label, ok, detail = '') => {
    console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
    if (!ok) fail++;
  };

  try {
    await build({
      alias: sharedAliases(),
      entryPoints: {
        household: fileURLToPath(new URL('../src/lib/household.ts', import.meta.url)),
      },
      bundle: true,
      format: 'esm',
      outdir: dir,
      outExtension: { '.js': '.mjs' },
      logLevel: 'error',
    });

    const mod = await import(pathToFileURL(join(dir, 'household.mjs')).href);
    
    // Initial state
    const prev = {
      posts: [],
      conversations: [],
      messages: [],
      households: [],
      passes: [],
    };

    // test createHousehold
    const st1 = mod.createHousehold(prev, 'user1', 'roommates', ['user1', 'user2', 'user3'], 'My House');
    check('createHousehold adds household', st1.households.length === 1);
    check('createHousehold handles members correctly', st1.households[0].members.length === 3);
    const m1 = st1.households[0].members.find(m => m.accountId === 'user1');
    check('createHousehold creator is joined immediately', m1 && m1.joined !== undefined);
    const m2 = st1.households[0].members.find(m => m.accountId === 'user2');
    check('createHousehold invitee is not joined', m2 && m2.joined === undefined);

    // test joinHousehold (1st join)
    const householdId = st1.households[0].id;
    const st2 = mod.joinHousehold(st1, householdId, 'user2');
    const m2Joined = st2.households[0].members.find(m => m.accountId === 'user2');
    check('joinHousehold invitee joins', m2Joined && m2Joined.joined !== undefined);

    const joinedCount = st2.households[0].members.filter(m => m.joined).length;
    check('joinHousehold joined count', joinedCount === 2);
    check('joinHousehold creates roommates thread on 2nd member', st2.conversations.length === 1 && st2.conversations[0].isGroup);
    
    // test joinHousehold (3rd join)
    const st3 = mod.joinHousehold(st2, householdId, 'user3');
    check('joinHousehold adds 3rd to existing thread', st3.conversations.length === 1 && st3.conversations[0].memberIds.length === 3);

    // test offerPass
    const piece = { id: 'p1', name: 'Shirt', color: 'red', season: ['summer'], addedAt: '2026-01-01', size: 'M', material: 'cotton', brand: 'Gap', price: 10 };
    const st4 = mod.offerPass(st3, 'user1', 'User One', 'user2', piece, 5);
    check('offerPass adds pass to state', st4.passes.length === 1);
    check('offerPass has correct status', st4.passes[0].status === 'offered');
    check('offerPass keeps provenance wears', st4.passes[0].provenance.wearsInTheirRecord === 5);

    // test settlePass
    const passId = st4.passes[0].id;
    const st5 = mod.settlePass(st4, passId, 'accepted');
    check('settlePass updates status', st5.passes[0].status === 'accepted');

  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(fail === 0 ? '\nALL TESTS PASSED' : `\n${fail} TESTS FAILED`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
