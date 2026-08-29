# Almari — setting up the account and the relay

The app works fully without any of this. This runbook is for the owner —
the person running the house — to switch on the two optional pieces:

1. **The account** (Supabase Auth + the `wardrobes` table) so a wardrobe can
   keep a copy of its record on more than one device.
2. **The AI relay** (the `ai-proxy` edge function) so cataloguing a
   photograph works without anyone needing their own key.

Everything below is done once. Nothing here is a secret except your
Kimi (Moonshot AI) key, which is never written in this repo — it goes
straight into Supabase's secret store in step 4.

---

## 1. The tables and the lock (SQL)

Open the [SQL editor](https://supabase.com/dashboard/project/wvupsqfevlrmhqfjreyx/sql)
in the Supabase dashboard, paste in the whole of `supabase/setup.sql`, and run it.

It is idempotent — safe to paste and run again.

**Verify:** in the [table editor](https://supabase.com/dashboard/project/wvupsqfevlrmhqfjreyx/editor)
you should see `public.profiles` and `public.wardrobes`, each with
"RLS enabled". The policies are owner-only: a signed-in person can only ever
read or write their own rows.

## 2. Auth: email on, confirmation off (for the alpha)

In [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/wvupsqfevlrmhqfjreyx/auth/providers):

- Enable **Email**.
- Under its settings, **disable "Confirm email"**.

Disabling confirmation is what lets `signUp` hand back a live session
immediately — the alpha has no email-sending set up, so a confirmation link
would never arrive. When you later want confirmation on, the app already
copes: it tells the person to confirm from their email and then sign in.

**Verify:** from the app (or its Door page), make an account with an email
and a 6+ character password. You should land signed in, with no email step.
The user appears in
[Authentication → Users](https://supabase.com/dashboard/project/wvupsqfevlrmhqfjreyx/auth/users).

## 3. The CLI

```sh
npm install -g supabase        # or use `npx supabase` in place of every command below
supabase login                 # opens the browser, once
supabase link --project-ref wvupsqfevlrmhqfjreyx
```

Run these from the repo root, where `supabase/config.toml` lives. Linking
writes a local `.gitignore`d reference, not a secret.

## 4. The relay: key in, function out

```sh
# Your own Kimi (Moonshot AI) key goes here — the value itself, never written
# to any file in this repo.
supabase secrets set KIMI_KEY=<your-kimi-key>

supabase functions deploy ai-proxy
```

The repo's `supabase/config.toml` already sets `verify_jwt = false` for this
function — the app calls it with no Authorization header, because the app has
no key to send. If you deploy without that config (or from elsewhere), use:

```sh
supabase functions deploy ai-proxy --no-verify-jwt
```

**Verify the secret is set** (prints names only, never values):

```sh
supabase secrets list
```

**Verify the relay end to end** — this asks the model to say a word, and a
working relay answers with JSON containing it. The body is an ordinary
OpenAI-compatible chat-completions request, exactly what the app sends; the
relay adds the key:

```sh
curl -X POST https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy \
  -H 'content-type: application/json' \
  -d '{"model":"k3","max_tokens":8000,"messages":[{"role":"user","content":[{"type":"text","text":"Reply with the single word: hem"}]}]}'
```

- A `200` with `choices[0].message.content` naming the word: the relay works.
  (Kimi K3 is a reasoning model — the reasoning rides along in
  `reasoning_content` and spends from the same token budget, which is why
  `max_tokens` is generous. The answer is always `message.content`.)
- `503` with "not configured": step 4's `secrets set` has not happened (or the
  function was deployed before the secret — redeploy).
- `401` from upstream: the Kimi key is wrong or expired — set it again.
- A CORS error from the browser but `200` from curl: the function is
  enforcing JWT — redeploy with `--no-verify-jwt` as above.

Then in the app: Settings → Catalogue from photos → Open the bench, and read
one of the sample photographs. The network panel says exactly where the
photograph goes before any button is pressed.

## 5. Sync, end to end

1. In the app, sign in (Door page or Settings → Account).
2. Start a wardrobe and choose **Synced to my account** (or flip an existing
   one under Wardrobes → Details → "Where the record lives").
3. Catalogue a piece. Within a second, a row appears in the `wardrobes`
   table (table editor), its `state` holding the closet.
4. Open the app in a second browser, sign in with the same account — the
   wardrobe appears on the door, whole.

The semantics to know: sync is **last-writer-wins, whole wardrobe at a
time**, judged by the row's `updated_at`. Offline pushes queue on the device
and flush on the next online moment. Signing out deletes nothing; retiring a
synced wardrobe removes its row.

## What could go wrong, in one table

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "Could not reach the account service" | offline, or project paused | check the dashboard; the app still works |
| Sign-up asks for email confirmation | step 2 skipped | disable "Confirm email" |
| Wardrobe does not appear on device two | RLS not applied, or sync set to "on this device" | rerun setup.sql; check Wardrobes → Details |
| Relay `503` | `KIMI_KEY` unset | step 4 |
| Relay `401` from browser only | JWT enforced | `--no-verify-jwt` deploy |

## 6. The alpha usage record (optional, opt-in)

PLAN.md non-negotiable #1 was amended by owner direction on 2026-08-28 to
admit an opt-in usage record for the alpha only — a closed vocabulary of
product events (screen views, wear-logged counts, error kinds), never
wardrobe content. This step is what makes the send side of it work; nothing
breaks if it is skipped — a tester who never sees this deployed simply has
their events sit harmlessly in the local ring buffer (src/lib/usage.ts)
until Settings' consent panel is wired up, and nothing is lost by that delay
because nothing is buffered until consent is granted in the first place.

```sh
supabase functions deploy usage --no-verify-jwt
```

`--no-verify-jwt` for the same reason as `ai-proxy` above: the app calls this
function with no Authorization header, because it has no user session to
send one from — the whole point of an install id instead of an account id is
that this works for someone who has never signed in.

No secret to set beyond what Supabase already injects: `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every edge
function on this project (the same pair `admin-stats` already relies on),
and the usage function uses the service role to write rows and to satisfy a
revoke's delete-by-install-id — see the RLS comment in `supabase/setup.sql`
for why that specific operation is not left to the anon key.

**Verify the table exists and is locked down:** step 1's `setup.sql` paste
already created `public.usage_events` — reopen the
[table editor](https://supabase.com/dashboard/project/wvupsqfevlrmhqfjreyx/editor)
and confirm it shows "RLS enabled" with exactly one policy (insert, anon).

**Verify the function end to end** — this posts one honest event and expects
it stored, then asks for it back and expects nothing (no read for the
device, only the erase-by-install-id path leaves this a way to check its own
work — see setup.sql's own verification block for a signed-in SQL check):

```sh
curl -X POST https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/usage \
  -H 'content-type: application/json' \
  -d '{"installId":"deploy-check","sentAt":"2026-01-01T00:00:00.000Z","build":"deploy-check","events":[{"name":"app_opened","at":1735689600000,"props":{"cold":true,"standalone":false}}]}'
```

- `{"stored":1}`: the function works.
- `400` naming an event or a field: expected if you edit the sample above —
  that is clamp 3/4 (the vocabulary allowlist and the property-shape check)
  doing exactly its job.
- A CORS error from the browser but success from curl: the function is
  enforcing JWT — redeploy with `--no-verify-jwt` as above.

Then erase what the check just wrote, so the deploy check does not sit in
the table forever pretending to be a real tester:

```sh
curl -X DELETE https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/usage \
  -H 'content-type: application/json' \
  -d '{"installId":"deploy-check"}'
```

`{"erased":1}` confirms the row is gone — the same call Settings makes on a
real revoke, against a real tester's install id instead of this one.

## The relay's clamps (added 2026-08-20)

`ai-proxy` is no longer a pure pass-through. Four clamps stand, each commented
in the function: a model allowlist (`ALLOWED_MODELS` — adding a model to the
app now means adding it there and redeploying, or the new model answers with
a calm 400), a `max_tokens` ceiling of 16000 (larger asks are rewritten down),
a body-size cap sized for a prepared photograph (over it, 413), and an Origin
check (the Pages origin and localhost pass; other browser origins get 403;
requests with no Origin — servers, the test suite — pass). A hosting move to
any new origin must extend the Origin list first. Belt-and-braces: keep spend
caps set in the Anthropic and Google consoles.
