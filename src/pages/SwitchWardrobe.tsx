import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { Button, Card, Field, LinkButton, Masthead, SectionTitle, inputClass } from '../components/ui';
import { Basting } from '../components/art';
import { IconPlus } from '../components/icons';
import { WardrobeList, StartWardrobeForm, START_LEDE } from './Door';

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
        Kept in this browser, one record each. Nothing here is an account.
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
            <Button onClick={installSamples}>Add the three sample wardrobes</Button>
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
  const { active, updateAccount, removeAccount } = useSession();
  const [confirming, setConfirming] = useState(false);
  if (!active) return null;

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
      </div>

      <Basting className="my-5" />

      {/* The only destructive act in the app, and it takes two decisions. */}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button tone="destructive" onClick={() => removeAccount(active.id)}>Retire it</Button>
          <Button onClick={() => setConfirming(false)}>Keep it</Button>
          <p className="type-ledger text-[11px] text-text-2 basis-full">
            This erases {active.name}&rsquo;s records from this browser. Export a backup first if
            there is any doubt — there is no copy anywhere else.
          </p>
        </div>
      ) : (
        <Button onClick={() => setConfirming(true)}>Retire this wardrobe</Button>
      )}
    </Card>
  );
}
