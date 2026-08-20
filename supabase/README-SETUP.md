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
