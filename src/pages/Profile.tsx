import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Card, EmptyState, LinkButton, Masthead, SectionTitle, Stat } from '../components/ui';
import { Basting, PlateEmptyCloset } from '../components/art';
import { AccountMark, LookCard, shortDate } from '../components/social';
import { postVisibleTo } from '../types';
import { personaById } from '../lib/personaWardrobe';
import { formatMoney } from '../lib/cost';

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
  const { accounts, activeId, community } = useSession();
  const wardrobe = useWardrobe();

  const targetId = id ?? activeId;
  const account = accounts.find(a => a.id === targetId);
  const isMe = targetId === activeId;
  const persona = targetId ? personaById(targetId) : undefined;

  const shared = useMemo(
    () => community.posts
      .filter(p => p.authorId === targetId && postVisibleTo(p, activeId, community.conversations))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [community.posts, community.conversations, targetId, activeId]
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
            action={<LinkButton to="/feed" tone="primary">Back to the feed</LinkButton>}
          />
        </Card>
      </>
    );
  }

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

      {isMe ? (
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            <Stat value={wardrobe.activeItems.length} label="In the closet" />
            <Stat value={worn.toLocaleString('en-US')} label="Wears recorded" />
            <Stat value={wardrobe.outfits.length} label="Outfits" />
            <Stat value={spend > 0 ? formatMoney(spend) : '—'} label="What it cost" />
          </div>
        </Card>
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

      <Card>
        <SectionTitle aside={`${shared.length} shown`}>
          {isMe ? 'What you are showing' : 'On show'}
        </SectionTitle>
        {shared.length === 0 ? (
          <p className="text-[14px] text-text-2 leading-snug">
            {isMe
              ? 'None of your looks are on show. Sharing happens one look at a time, from the outfit itself.'
              : 'This wardrobe has not put anything on show.'}
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {shared.map(post => (
              <li key={post.id}>
                {post.look ? <LookCard look={post.look} /> : null}
                <p className="type-ledger text-[11px] text-text-2 tabular mt-1.5">{shortDate(post.date)}</p>
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
    </div>
  );
}
