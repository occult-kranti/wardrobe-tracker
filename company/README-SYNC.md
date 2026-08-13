# The Workroom — making the board shared

The workroom (`tracker.html` + `tracker.js`) works the moment you open it, but by
default **it saves to whichever browser you opened it in**. Kunjal's edits stay on
Kunjal's laptop. That is not a design choice — GitHub Pages serves files and
nothing else, so a board four people share needs a small database behind it.

This is the five-minute fix. It costs nothing at this size.

## What you get

- Everyone sees everyone's changes within about five seconds.
- Merge is per task, by timestamp: two people editing different tasks never
  clobber each other. Two people editing *the same* task in the same five
  seconds — the later save wins, and the earlier one is lost. For a team of four
  working from a shared board, that is fine; know it rather than discover it.
- It keeps working offline. Edits queue in the browser and go up on the next
  successful save.

## Setup

1. **Make a project** at [supabase.com](https://supabase.com). Free tier, any region
   near you (Mumbai/Singapore for India).

2. **Run this in the SQL editor** (left sidebar → SQL Editor → New query):

   ```sql
   create table almari_workroom (
     id int primary key,
     doc jsonb not null,
     updated_at timestamptz default now()
   );

   alter table almari_workroom enable row level security;

   create policy "team read"  on almari_workroom for select using (true);
   create policy "team write" on almari_workroom for insert with check (true);
   create policy "team edit"  on almari_workroom for update using (true);
   ```

   Those three policies say: anyone holding the anon key may read and write this
   one table. That is the right trade for a small trusted team and the wrong one
   for anything with real secrets in it. **Do not put anything in the workroom you
   would not put in a shared document** — no passwords, no bank details, no
   customer data.

3. **Copy the two values** from Project Settings → API: the **Project URL** and the
   **anon** (publishable) key. The anon key is designed to sit in a page; row-level
   security is what protects the data, not the key's secrecy.

4. **Paste them into `company/tracker.js`**, at the top:

   ```js
   const SYNC = {
     url: 'https://YOURPROJECT.supabase.co',
     key: 'eyJhbGciOi...',            // the anon key
     table: 'almari_workroom',
     row: 1,
     pollMs: 5000,
   };
   ```

5. **Commit and push.** Once the site redeploys, the header reads **Shared**
   instead of **This device only**.

## Notes

- **Signing in is a name badge, not a password.** Anyone with the link can pick any
  name. It labels edits and notes so the team knows who did what — it is not access
  control. Keep the link inside the team; the page carries `noindex` so search
  engines skip it, which is not the same as being private.
- **The Export button** writes the whole board to a JSON file, in the same spirit as
  the app's own lossless export. Take one before any big reorganisation.
- **Seed data lives in `tracker.js`** (`SEED_TASKS`). It is only used the first time
  a browser or a fresh database opens the board — after that the stored document
  wins, so editing the seed will not disturb work already in flight. To re-seed
  deliberately, clear the row and let the next visitor write it fresh.
- **If Supabase is ever the wrong answer**, the storage layer is four functions at
  the top of `tracker.js` (`pullShared`, `pushShared`, `mergeDocs`, `persist`).
  Anything that can store and return a JSON blob will do.
