import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { Button, Card, Field, LinkButton, Masthead, SectionTitle, inputClass } from '../components/ui';
import { Basting } from '../components/art';
import { IconPlus } from '../components/icons';
import { PERSONAS } from '../lib/personaWardrobe';
import { syncModeOf } from '../lib/sync';
import { showToast } from '../components/Toast';
import { AccountPanel, Choice, WardrobeList, StartWardrobeForm, START_LEDE } from './Door';

/**
 * Switching wardrobes. Nothing is written and nothing is lost — every mutation
 * already writes through to its own wardrobe's store, so this changes one field:
 * which one is open. The shared rail stays where it is and is simply spoken for
 * by a different wardrobe afterwards.
 *
 * Same list component as the door, so the two screens can never drift.
 */
export default function SwitchWardrobe() {
  const { accounts, activeId, signIn, signOut, installSamples } = useSession();
  const navigate = useNavigate();

  const choose = (id: string) => {
    if (id === activeId) return;
    signIn(id);
    // replace, so the back button does not walk into the wardrobe you just left.
    navigate('/', { replace: true });
  };

  return (
    <div className="space-y-6">
      <Masthead title="Wardrobes" meta={`${accounts.length} on this device`} />
      <p className="type-ledger text-[11px] text-text-2 -mt-2">
        Kept in this browser, one record each. A wardrobe is not an account — an account only
        keeps a copy of the wardrobes you ask it to.
      </p>

      <Card>
        <SectionTitle aside="choose one">Open a wardrobe</SectionTitle>
        <WardrobeList accounts={accounts} activeId={activeId} onChoose={choose} />

        <Basting className="my-4" />

        <div className="flex flex-wrap items-center gap-3">
          <LinkButton to="/open/new" tone="primary" icon={<IconPlus size={16} />}>
            Start another wardrobe
          </LinkButton>
          {/* The samples are reachable from here and not only from the door:
              someone who started their own wardrobe first would otherwise have
              no way to see a populated screen ever again. */}
          {accounts.some(a => a.isSample) ? null : (
            <Button onClick={installSamples}>Add the {PERSONAS.length} sample wardrobes</Button>
          )}
          <Button onClick={signOut}>Close this wardrobe</Button>
        </div>
        <p className="type-ledger text-[11px] text-text-2 mt-4">
          A second wardrobe can be started without closing this one. Closing returns to the door;
          nothing is deleted either way.
        </p>
      </Card>

      <WardrobeDetails />
    </div>
  );
}

/** /open/new inside the frame — starting a second wardrobe without closing the first. */
export function StartWardrobe() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <Masthead title="Start a wardrobe" />
      <Card>
        <p className="text-[14px] text-text-2 leading-relaxed">{START_LEDE}</p>
        <StartWardrobeForm onDone={() => navigate('/', { replace: true })} />
      </Card>
    </div>
  );
}

/**
 * The three fields the door stopped asking for, asked here instead — where
 * there is a wardrobe to attach them to and no cost to skipping them.
 */
function WardrobeDetails() {
  const { active, updateAccount, removeAccount, authUser } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [wantSync, setWantSync] = useState(false);

  /* The choice made while signed out has to survive the sign-in it asked for.
     Pressing "Synced to my account" with no account parked the intent in
     wantSync and showed the panel; when the account landed the panel simply
     disappeared — which reads as success — and the wardrobe was still kept on
     the device. A tester who came here to switch sync on left with no copy
     anywhere and no sentence saying so. The Door's start form always completed
     the choice; this variant is the one that dropped it. It completes here,
     and says so. */
  useEffect(() => {
    if (!wantSync || !authUser || !active || active.isSample) return;
    setWantSync(false);
    if (syncModeOf(active) === 'cloud') return;
    updateAccount(active.id, {
      sync: 'cloud',
      syncId: active.syncId ?? crypto.randomUUID(),
    });
    showToast('Synced from now on. A copy is kept on your account.', 'success');
  }, [wantSync, authUser, active, updateAccount]);

  if (!active) return null;

  const mode = syncModeOf(active);

  return (
    <Card>
      <SectionTitle aside="this wardrobe">Details</SectionTitle>
      <div className="space-y-5 mt-4">
        <Field label="Name" htmlFor="wd-name">
          <input
            id="wd-name"
            className={inputClass}
            value={active.name}
            onChange={e => updateAccount(active.id, { name: e.target.value })}
          />
        </Field>
        <Field label="Handle" htmlFor="wd-handle" hint="Used where a short name fits better.">
          <input
            id="wd-handle"
            className={inputClass}
            value={active.handle}
            onChange={e => updateAccount(active.id, { handle: e.target.value })}
          />
        </Field>
        <Field label="City" htmlFor="wd-city" hint="Optional. It only shapes the weather notes.">
          <input
            id="wd-city"
            className={inputClass}
            value={active.city ?? ''}
            onChange={e => updateAccount(active.id, { city: e.target.value || undefined })}
            placeholder="Where you dress"
          />
        </Field>
        <Field label="One line about how you dress" htmlFor="wd-line" hint="Optional. Shown on your profile.">
          <input
            id="wd-line"
            className={inputClass}
            value={active.tagline ?? ''}
            onChange={e => updateAccount(active.id, { tagline: e.target.value || undefined })}
            placeholder="Mends before replacing"
          />
        </Field>

        {/* Where the record lives. Samples never get the choice — a worked
            example belongs to the device that installed it. */}
        {active.isSample ? null : (
          <div>
            <p className="type-ledger text-[11px] text-text-2">Where the record lives</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Choice
                active={mode === 'device'}
                onPress={() => { setWantSync(false); updateAccount(active.id, { sync: 'device' }); }}
              >
                On this device
              </Choice>
              <Choice
                active={mode === 'cloud'}
                onPress={() => {
                  // Signed out, the choice cannot hold — offer the sign-in
                  // instead of silently starting a wardrobe that cannot sync.
                  if (!authUser) { setWantSync(true); return; }
                  setWantSync(false);
                  updateAccount(active.id, {
                    sync: 'cloud',
                    syncId: active.syncId ?? crypto.randomUUID(),
                  });
                }}
              >
                Synced to my account
              </Choice>
            </div>
            <p className="text-[13px] text-text-2 leading-snug mt-2">
              {mode === 'device'
                ? 'Kept in this browser only. If a copy was ever synced, it is left on the account as it was, and is no longer updated.'
                : 'A copy is kept on your account, updated as you work, so another device can open it.'}
            </p>
            {/* WHO CAN READ IT — stated where the choice is made, not in a
                policy page nobody opens. The synced record is plaintext in the
                database today (lib/sync.ts ships envelope alg 'none'), and
                row-level security keeps other users out while doing nothing
                about the operator or the host. End-to-end encryption is the
                committed target (docs/35, owner decision 2026-08-19); this
                sentence comes out the day it ships and not before. No alarm
                styling — it is a fact about where cloth is kept, in the same
                grey as the line above it. */}
            <p className="text-[13px] text-text-2 leading-snug mt-2">
              Until end-to-end encryption arrives, a synced copy is stored readable: the person
              running Almari and the company hosting the database could open it. Keep the record on
              this device if that is not acceptable.
            </p>
            {wantSync && !authUser ? (
              <div className="rounded-[2px] border border-border bg-sunken p-4 mt-3">
                <p className="type-ledger text-[11px] text-text-2 mb-3">Syncing needs the account it syncs to</p>
                <AccountPanel idPrefix="wd-acct" />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Basting className="my-5" />

      {/* The only destructive act in the app, and it takes two decisions. */}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button tone="destructive" onClick={() => removeAccount(active.id)}>Retire it</Button>
          <Button onClick={() => setConfirming(false)}>Keep it</Button>
          <p className="type-ledger text-[11px] text-text-2 basis-full">
            {mode === 'cloud'
              ? `This erases ${active.name}’s records from this browser and removes the copy on your account. Export a backup first if there is any doubt.`
              : `This erases ${active.name}’s records from this browser. Export a backup first if there is any doubt — there is no copy anywhere else.`}
          </p>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)}>Retire this wardrobe</Button>
      )}
    </Card>
  );
}
