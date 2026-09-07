/** Explicit billable smoke test. A local auth shim runs the real gate source;
 * provider calls reach the deployed relay. This does not prove a valid secret
 * against the deployed admin gate. Its unauthenticated refusal is checked live.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { sharedAliases } from '../packages/shared/aliases.mjs';
if (!process.argv.includes('--live')) { console.log('Pass --live for four synthetic image calls and one event call. Usage is billable. No private wardrobe or production admin token is read.'); process.exit(0); }
const scratch = mkdtempSync(join(tmpdir(),'almari-workbench-live-'));
const output = 'shots/portal-workbench-live';
mkdirSync(output,{recursive:true});
const network = globalThis.fetch;
let browser;
try {
  await build({ alias: sharedAliases(), entryPoints:{client:'src/portal/lib/workbenchClient.ts',cost:'src/portal/lib/modelCost.ts',cases:'src/portal/lib/workbenchCases.ts'},
    bundle:true,format:'esm',outdir:scratch,outExtension:{'.js':'.mjs'},logLevel:'error' });
  const {runModel,ADMIN_AI_ENDPOINT} = await import(pathToFileURL(join(scratch,'client.mjs')));
  const {normalizeUsage,estimateModelCost} = await import(pathToFileURL(join(scratch,'cost.mjs')));
  const {analyseWorkbenchResult,workbenchPreset} = await import(pathToFileURL(join(scratch,'cases.mjs')));
  const refused = await network(ADMIN_AI_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','x-admin-token':'deliberately-invalid-test-token'},body:'{}'});
  assert.equal(refused.status,401,'deployed admin gate rejects an invalid token');
  console.log('PASS - deployed admin gate refuses unauthenticated model spending');
  const edge = await build({stdin:{contents:readFileSync('supabase/functions/admin-ai/index.ts','utf8'),loader:'ts'},bundle:false,write:false,target:'es2022'});
  let handler;
  vm.runInNewContext(edge.outputFiles[0].text,{ Request,Response,Headers,TextDecoder,Uint8Array,AbortSignal,
    Deno:{serve:fn=>{handler=fn;},env:{get:name=>({ADMIN_TOKEN:'local-contract-only',SUPABASE_URL:'https://wvupsqfevlrmhqfjreyx.supabase.co'})[name]}},fetch:network });
  globalThis.fetch = (url,init) => String(url) === ADMIN_AI_ENDPOINT ? handler(new Request(url,init)) : network(url,init);
  browser = await chromium.launch();
  const page = await browser.newPage({viewport:{width:720,height:540},deviceScaleFactor:1});
  // Code-native synthetic test illustration; no photograph of a person or wardrobe.
  await page.setContent(`<html><body style="margin:0;background:#f5f1ec"><svg xmlns="http://www.w3.org/2000/svg" width="720" height="540" viewBox="0 0 720 540"><rect width="720" height="540" fill="#f5f1ec"/><path d="M95 110L155 72L205 72L265 110L237 166L215 155L215 300L145 300L145 155L122 166Z" fill="#fafafa" stroke="#999" stroke-width="3"/><path d="M350 80L470 80L485 370L432 370L408 197L389 370L338 370Z" fill="#293b59" stroke="#17243c" stroke-width="3"/><path d="M118 397L167 397L185 425L238 441L241 464L106 464Z" fill="#252525"/><path d="M342 411L390 411L409 439L461 455L464 478L330 478Z" fill="#252525"/></svg></body></html>`);
  const png = await page.screenshot({path:join(output,'synthetic-input.png')});
  await browser.close(); browser = null;
  const selected = process.argv.find(arg=>arg.startsWith('--model='))?.slice(8);
  const report = selected ? JSON.parse(readFileSync(join(output,'report.json'),'utf8')) : {checkedAt:new Date().toISOString(),syntheticOnly:true,authScope:'Real gate source under a local auth shim; live deployed refusal and live deployed provider relay. Production valid-token path not exercised.',results:[]};
  for (const modelId of ['claude-fable-5-1','claude-opus-5','gemini-3.7-flash','k3'].filter(id=>!selected||id===selected)) {
    const preset = workbenchPreset('flatlay');
    try {
      const result = await runModel({modelId,token:'local-contract-only',system:preset.system,prompt:preset.prompt,image:{mimeType:'image/png',base64:png.toString('base64')},maxTokens:8000});
      const usage = normalizeUsage(modelId,result.raw), cost = estimateModelCost(modelId,usage,result.requestedAt);
      const analysis = analyseWorkbenchResult('flatlay',result.text,[]);
      report.results.push({feature:'flatlay',...result,usage,cost,analysis});
      console.log(`${analysis.status === 'invalid' ? 'REVIEW' : 'PASS'} - ${modelId}: ${analysis.summary} ${cost.label}`);
    } catch (error) {
      report.results.push({feature:'flatlay',requestedModel:modelId,error:error.message,status:error.status??null});
      console.log(`REVIEW - ${modelId}: ${error.message}`);
    }
    writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));
  }
  if (selected) { console.log('Recorded the targeted live retry.'); process.exitCode = 0; }
  else {
  const preset = workbenchPreset('event');
  const result = await runModel({modelId:'claude-fable-5-1',token:'local-contract-only',system:preset.system,prompt:preset.prompt,maxTokens:8000});
  const usage = normalizeUsage('claude-fable-5-1',result.raw), cost = estimateModelCost('claude-fable-5-1',usage,result.requestedAt);
  const analysis = analyseWorkbenchResult('event',result.text,preset.items);
  report.results.push({feature:'event',...result,usage,cost,analysis});
  writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));
  assert.equal(analysis.status,'valid','live event result has only submitted IDs');
  assert.ok(report.results.some(r=>r.feature==='flatlay' && r.analysis?.pieces.length),'at least one live model produces image intake pieces');
  console.log(`PASS - Fable 5.1 event case: ${analysis.summary} ${cost.label}`);
  console.log('Recorded live provider evidence in shots/portal-workbench-live/report.json');
  }
} finally {
  globalThis.fetch = network;
  if (browser) await browser.close();
  rmSync(scratch,{recursive:true,force:true});
}
