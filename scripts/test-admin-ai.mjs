/** Auth/body/provider contract tests run offline against the actual Edge Function. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../supabase/functions/admin-ai/index.ts', import.meta.url), 'utf8');
const compiled = await build({ stdin: { contents: source, loader: 'ts' }, bundle: false, write: false, target: 'es2022' });
const code = compiled.outputFiles[0].text;
let handler;
let calls = [];
const env = { ADMIN_TOKEN: 'test-only-secret', SUPABASE_URL: 'https://test-project.supabase.co' };
const context = vm.createContext({ Request, Response, Headers, TextDecoder, Uint8Array, AbortSignal,
  Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn; } },
  fetch: async (url, init) => { calls.push({ url, ...init }); return new Response(JSON.stringify({ model: 'claude-fable-5-1', content: [{type:'text',text:'ok'}], usage: {input_tokens:10,output_tokens:2} }), {headers:{'content-type':'application/json'}}); },
});
vm.runInContext(code, context);
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS - ${name}`); }
async function ask({ token = env.ADMIN_TOKEN, method = 'POST', body, raw, headers = {} } = {}) {
  calls = [];
  return handler(new Request('https://test/admin-ai', { method, headers: { ...(token ? {'x-admin-token':token} : {}), ...headers },
    ...(method === 'POST' ? {body: raw ?? JSON.stringify(body ?? {model:'claude-fable-5-1',system:'system',prompt:'shirt',maxTokens:8000})} : {}) }));
}
await test('missing and wrong auth refuse before any provider call', async () => {
  for (const token of ['', 'incorrect']) { assert.equal((await ask({token,raw:'broken JSON'})).status,401); assert.equal(calls.length,0); }
});
await test('unconfigured admin refuses without provider work', async () => {
  const saved = env.ADMIN_TOKEN; delete env.ADMIN_TOKEN;
  assert.equal((await ask()).status,503); assert.equal(calls.length,0); env.ADMIN_TOKEN = saved;
});
await test('preflight does not spend tokens', async () => {
  const res = await ask({method:'OPTIONS',token:''}); assert.equal(res.status,204); assert.equal(calls.length,0);
  assert.match(res.headers.get('access-control-allow-headers'),/x-admin-token/);
});
await test('origin and method are checked', async () => {
  assert.equal((await ask({headers:{origin:'https://unrelated.example'}})).status,403); assert.equal(calls.length,0);
  assert.equal((await ask({method:'GET'})).status,405); assert.equal(calls.length,0);
});
await test('bad JSON, unsupported model and unsafe images do not reach provider', async () => {
  for (const raw of ['null','[]','{']) { assert.equal((await ask({raw})).status,400); assert.equal(calls.length,0); }
  for (const extra of [{model:'arbitrary-model'}, {maxTokens:-1}, {maxTokens:1.2}, {image:{mimeType:'image/svg+xml',base64:'AAAA'}}, {image:{mimeType:'image/png',base64:'https://private.invalid'}}]) {
    assert.equal((await ask({body:{model:'k3',system:'',prompt:'hi',...extra}})).status,400); assert.equal(calls.length,0);
  }
});
await test('actual UTF-8 request size and declared size are bounded', async () => {
  assert.equal((await ask({headers:{'content-length':String(9*1024*1024)}})).status,413); assert.equal(calls.length,0);
  assert.equal((await ask({raw:'\u00e9'.repeat(5*1024*1024)})).status,413); assert.equal(calls.length,0);
});
await test('Claude image protocol, token cap and fixed relay destination', async () => {
  const response = await ask({body:{model:'claude-fable-5-1',system:'test system',prompt:'test',maxTokens:999999,image:{mimeType:'image/png',base64:'AAAA'},tools:[{name:'unexpected'}],url:'https://evil.invalid'}});
  assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(calls.length,1); assert.equal(calls[0].url,'https://test-project.supabase.co/functions/v1/ai-proxy');
  assert.equal(JSON.stringify(calls).includes('test-only-secret'),false);
  const sent = JSON.parse(calls[0].body); assert.equal(sent.max_tokens,16000); assert.equal(sent.system,'test system');
  assert.equal(sent.messages[0].content[0].source.data,'AAAA'); assert.equal(sent.tools,undefined); assert.equal(sent.url,undefined);
  assert.deepEqual((await response.json()).usage,{input_tokens:10,output_tokens:2});
});
await test('Gemini and Kimi image requests use chat format without disabling thinking', async () => {
  for (const model of ['gemini-3.7-flash','k3']) {
    assert.equal((await ask({body:{model,system:'sys',prompt:'hi',image:{mimeType:'image/jpeg',base64:'AAAA'}}})).status,200);
    const sent = JSON.parse(calls[0].body); assert.equal(sent.messages[0].role,'system');
    assert.equal(sent.messages[1].content[0].image_url.url,'data:image/jpeg;base64,AAAA'); assert.equal(sent.thinking,undefined);
  }
});
await test('photo presets omit empty system messages required by Kimi', async () => {
  assert.equal((await ask({body:{model:'k3',system:'',prompt:'describe'}})).status,200);
  const sent = JSON.parse(calls[0].body);
  assert.equal(sent.messages.length,1); assert.equal(sent.messages[0].role,'user');
});
await test('consumer worker bypasses every portal path without caching', async () => {
  const listeners = {};
  vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'), {
    URL, Set, Request, Response, self:{location:new URL('https://example.test/wardrobe-tracker/sw.js'),addEventListener:(name,fn)=>{listeners[name]=fn;}},
  });
  for (const path of ['portal','portal/','portal/assets/test-abcd1234.js']) {
    let intercepted = false;
    listeners.fetch({request:new Request('https://example.test/wardrobe-tracker/'+path),respondWith:()=>{intercepted=true;}});
    assert.equal(intercepted,false);
  }
});
console.log(`${passed} admin AI and portal cache contracts passed.`);
