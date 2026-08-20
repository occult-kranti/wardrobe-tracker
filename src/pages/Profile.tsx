import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Button, Card, Chip, EmptyState, Field, LinkButton, Masthead, Modal, SectionTitle, Stat, inputClass } from '../components/ui';
import { Basting, PlateEmptyCloset } from '../components/art';
import { AccountMark, LookThumb, newestFirst, shortDate } from '../components/social';
import { HOUSEHOLD_KIND_LABELS, postVisibleTo, type HouseholdKind } from '@almari/shared/types';
import { createHousehold, joinHousehold, leaveHousehold } from '../lib/household';
import { showToast } from '../components/Toast';
import { personaById } from '../lib/personaWardrobe';
import { formatMoney } from '@almari/shared/cost';
import { FEED_ENABLED } from '@almari/shared/flags';

/**
 * A WARDROBE'S OWN PAGE — who keeps it, how they dress, and what they show.
 *
 * The philosophy, rules and never-wears are about cloth and craft, never about a
 * body: that is the same line the whole app holds, and it is why there is no
 * measurements block here even though the source personas carry one.
 *
 * Viewing someone else's page shows what they have shared, and nothing else —
 * their closet, their ledger and their calendar stay theirs.
 */
export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { accounts, activeId, community, setCommunity } = useSession();
  const wardrobe = useWardrobe();

  const targetId = id ?? activeId;
  const account = accounts.find(a => a.id === targetId);
  const isMe = targetId === activeId;
  const persona = targetId ? personaById(targetId) : undefined;

  // Hooks before any early return — a conditional hook reorders on the render
  // where `account` resolves, which is a crash, and exactly what the lint gate
  // stopped from deploying.
  const [roofOpen, setRoofOpen] = useState(false);
  const [roofKind, setRoofKind] = useState<HouseholdKind>('roommates');
  const [roofName, setRoofName] = useState('');
  const [roofInvites, setRoofInvites] = useState<string[]>([]);

  const shared = useMemo(
    () => community.posts
      .filter(p => p.authorId === targetId && postVisibleTo(p, activeId, community.conversations, community.households))
      .sort(newestFirst),
    [community.posts, community.conversations, community.households, targetId, activeId]
  );

  if (!account) {
    return (
      <>
        <Masthead title="Profile" />
        <Card>
          <EmptyState
            plate={<PlateEmptyCloset />}
            title="No record of this wardrobe."
            body="It may have been removed from this device."
            // The way out of a dead end has to be a door that opens. With the
            // Look Book hidden, /feed answers with Today anyway, and a button
            // that says "the feed" would be a plaque on a room that is not in
            // the house this season.
            action={FEED_ENABLED
              ? <LinkButton to="/feed" tone="primary">Back to the feed</LinkButton>
              : <LinkButton to="/" tone="primary">Back to today</LinkButton>}
          />
        </Card>
      </>
    );
  }


  const myHouseholds = community.households.filter(h =>
    h.members.some(m => m.accountId === activeId)
  );
  const invitations = myHouseholds.filter(h =>
    h.members.some(m => m.accountId === activeId && !m.joined)
  );
  const joinedHouseholds = myHouseholds.filter(h =>
    h.members.some(m => m.accountId === activeId && m.joined)
  );
  const nameOf = (id: string) => accounts.find(a => a.id === id)?.name ?? 'A wardrobe';

  const worn = isMe ? wardrobe.activeItems.reduce((sum, i) => sum + i.wearCount, 0) : 0;
  const spend = isMe ? wardrobe.activeItems.reduce((sum, i) => sum + (i.cost ?? 0), 0) : 0;

  return (
    <div className="space-y-6">
      <Masthead title={account.name} meta={account.handle} />

      <Card>
        <div className="flex items-start gap-5">
          <AccountMark account={account} size={72} />
          <div className="min-w-0 flex-1">
            {account.tagline ? (
              <p className="type-editorial text-[20px] sm:text-[22px] leading-snug text-balance">
                {account.tagline}
              </p>
            ) : null}
            <p className="type-ledger text-[11px] text-text-2 mt-3">
              {account.city ?? 'Somewhere'}
              {persona?.job ? ` · ${persona.job}` : ''}
              {account.isSample ? ' · sample wardrobe' : ''}
            </p>
            {isMe ? (
              <p className="type-ledger text-[11px] text-text-2 mt-1">
                This is the wardrobe you have open.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* The looks grid leads the page: what this wardrobe has chosen to show,
          newest first, before any words about how they dress. Image-first
          tiles only — the feed carries the captions.

          IT READS THE STORE THE FEED WRITES (docs/42 §2), so it is seated by
          the same flag. In alpha it is ABSENT, not empty: an "on show" heading
          over an explanation of a room that is not in the house would be the
          plaque the ruling forbids. Everything below — the counts, the roofs,
          the philosophy — is about this wardrobe alone and stays. */}
      {FEED_ENABLED ? (
        <Card>
          <SectionTitle aside={shared.length > 0 ? `${shared.length} shown` : undefined}>
            {isMe ? 'What you are showing' : 'On show'}
          </SectionTitle>
          {shared.length === 0 ? (
            <p className="text-[14px] text-text-2 leading-snug">
              {isMe
                ? 'None of your looks are on show. Sharing happens one look at a time, from the outfit itself.'
                : 'This wardrobe has not put anything on show.'}
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {shared.filter(post => post.look).map(post => (
                <li key={post.id} className="border border-border rounded-[2px] overflow-hidden">
                  <LookThumb look={post.look!} />
                  <p className="type-ledger text-[11px] text-text-2 tabular px-2 py-1.5 truncate">
                    {post.look!.name} · {shortDate(post.date)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {isMe ? (
            <>
              <Basting className="my-4" />
              <Link to="/outfits" className="type-label text-[13px] text-accent underline underline-offset-[3px] min-h-11 inline-flex items-center">
                Choose what you share
              </Link>
            </>
          ) : null}
        </Card>
      ) : null}

      {isMe ? (
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            <Stat value={wardrobe.activeItems.length} label="In the closet" />
            <Stat value={worn.toLocaleString('en-IN')} label="Wears recorded" />
            <Stat value={wardrobe.outfits.length} label="Outfits" />
            <Stat value={spend > 0 ? formatMoney(spend) : '—'} label="What it cost" />
          </div>
        </Card>
      ) : null}

      {isMe ? (
        <Card>
          <SectionTitle aside={joinedHouseholds.length > 0 ? `${joinedHouseholds.length} joined` : undefined}>
            Under this roof
          </SectionTitle>

          {invitations.map(h => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-border">
              <div className="min-w-0">
                <p className="text-[15px] text-text">{h.name ?? HOUSEHOLD_KIND_LABELS[h.kind]}</p>
                <p className="type-ledger text-[11px] text-text-2 mt-0.5">
                  {HOUSEHOLD_KIND_LABELS[h.kind]} · with {h.members.filter(m => m.accountId !== activeId).map(m => nameOf(m.accountId)).join(', ')} · waiting on your yes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button compact onClick={() => setCommunity(prev => joinHousehold(prev, h.id, activeId ?? ''))}>
                  Join
                </Button>
                <Button tone="tertiary" onClick={() => setCommunity(prev => leaveHousehold(prev, h.id, activeId ?? ''))}>
                  Not for me
                </Button>
              </div>
            </div>
          ))}

          {joinedHouseholds.length === 0 && invitations.length === 0 ? (
            <p className="text-[14px] text-text-2 leading-relaxed">
              Wardrobes on this device can be joined as housemates, partners, or family —
              one person can be under all three roofs at once. Each kind opens one door:
              a shared thread, a share scope for just the household, or pieces passed on.
            </p>
          ) : null}

          {joinedHouseholds.map(h => (
            <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-border last:border-0">
              <div className="min-w-0">
                <p className="text-[15px] text-text">{h.name ?? HOUSEHOLD_KIND_LABELS[h.kind]}</p>
                <p className="type-ledger text-[11px] text-text-2 mt-0.5">
                  {HOUSEHOLD_KIND_LABELS[h.kind]} · {h.members.filter(m => m.accountId !== activeId).map(m => `${nameOf(m.accountId)}${m.joined ? '' : ' (invited)'}`).join(', ') || 'just you so far'}
                </p>
              </div>
              <Button tone="tertiary" onClick={() => setCommunity(prev => leaveHousehold(prev, h.id, activeId ?? ''))}>
                Leave
              </Button>
            </div>
          ))}

          <div className="mt-4">
            <Button wrap onClick={() => setRoofOpen(true)}>Join wardrobes under a roof</Button>
          </div>
          <p className="text-[13px] text-text-2 mt-3 leading-snug">
            A household is ids and a kind, nothing else — no roles, no shape, no locks.
            Everyone joins by their own yes and leaves without asking.
          </p>
        </Card>
      ) : null}

      {isMe ? (
        <Modal open={roofOpen} onClose={() => setRoofOpen(false)} title="Under one roof">
          <div className="space-y-5">
            <Field label="What kind of roof">
              <div className="flex flex-wrap gap-2 pt-1">
                {(Object.keys(HOUSEHOLD_KIND_LABELS) as HouseholdKind[]).map(k => (
                  <Chip key={k} selected={roofKind === k} onClick={() => setRoofKind(k)}>
                    {HOUSEHOLD_KIND_LABELS[k]}
                  </Chip>
                ))}
              </div>
              <p className="text-[13px] text-text-2 mt-2 leading-snug">
                {roofKind === 'roommates'
                  ? 'You share the space, and sometimes the rail. A thread opens when the second person joins.'
                  : roofKind === 'partners'
                    ? 'You dress for the same evenings. Looks can be shared to just the household.'
                    : 'Pieces get passed on, with their story attached.'}
              </p>
            </Field>
            <Field label="Who else">
              <div className="flex flex-wrap gap-2 pt-1">
                {accounts.filter(a => a.id !== activeId).map(a => (
                  <Chip
                    key={a.id}
                    selected={roofInvites.includes(a.id)}
                    onClick={() =>
                      setRoofInvites(prev =>
                        prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                      )
                    }
                  >
                    {a.name}
                  </Chip>
                ))}
              </div>
              <p className="text-[13px] text-text-2 mt-2 leading-snug">
                They join when they say yes from their own wardrobe — never before.
              </p>
            </Field>
            <Field label="Name it" htmlFor="roof-name" hint="Optional. The flat, the house, the family name.">
              <input
                id="roof-name"
                className={inputClass}
                value={roofName}
                onChange={e => setRoofName(e.target.value)}
                placeholder="The Indiranagar flat"
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button
                tone="primary"
                disabled={roofInvites.length === 0}
                onClick={() => {
                  setCommunity(prev => createHousehold(prev, activeId ?? '', roofKind, roofInvites, roofName));
                  setRoofOpen(false);
                  setRoofName('');
                  setRoofInvites([]);
                  showToast('Raised. Invitations wait on their yes.', 'info');
                }}
              >
                Raise the roof
              </Button>
              <Button tone="tertiary" onClick={() => setRoofOpen(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {persona?.leadImage ? (
        <Card padded={false}>
          <span className="block w-full bg-mat overflow-hidden" style={{ aspectRatio: '3 / 4', maxHeight: 520 }}>
            <img src={persona.leadImage} alt={persona.leadCaption} className="w-full h-full object-cover" />
          </span>
          <p className="type-ledger text-[11px] text-text-2 p-4">{persona.leadCaption}</p>
        </Card>
      ) : null}

      {persona && persona.philosophy.length > 0 ? (
        <Card>
          <SectionTitle aside="how they dress">Philosophy</SectionTitle>
          <ol className="space-y-3">
            {persona.philosophy.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span className="type-ledger text-[11px] text-text-2 tabular pt-1 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[15px] text-text leading-relaxed">{line}</span>
              </li>
            ))}
          </ol>
          {persona.palette.colours.length > 0 ? (
            <>
              <Basting className="my-4" />
              <p className="type-ledger text-[11px] text-text-2 mb-2">{persona.palette.name}</p>
              <p className="text-[14px] text-text-2 leading-relaxed">
                {persona.palette.colours.join(' · ')}
              </p>
            </>
          ) : null}
        </Card>
      ) : null}

      {persona && persona.rules.length > 0 ? (
        <Card>
          <SectionTitle aside={`${persona.rules.length} rules`}>Wardrobe rules</SectionTitle>
          <ul className="space-y-2.5">
            {persona.rules.map((rule, i) => (
              <li key={i} className="text-[15px] text-text leading-relaxed">{rule}</li>
            ))}
          </ul>
          {persona.neverWears.length > 0 ? (
            <>
              <Basting className="my-4" />
              <p className="type-ledger text-[11px] text-text-2 mb-2">Never wears</p>
              <p className="text-[14px] text-text-2 leading-relaxed">{persona.neverWears.join(' · ')}</p>
            </>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
