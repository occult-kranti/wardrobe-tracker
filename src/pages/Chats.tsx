import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Button, Card, EmptyState, Field, LinkButton, Masthead, Modal, SectionTitle, inputClass, selectClass } from '../components/ui';
import { Basting, PlateEmptyWishlist } from '../components/art';
import { IconChevronLeft, IconPlus } from '../components/icons';
import { AccountMark, LookCard, PieceCard, shortDate, oldestFirst, nowLocalStamp } from '../components/social';
import { todayLocal } from '@almari/shared/dates';
import type { BorrowStatus, ChatMessage, SharedLook, SharedPiece } from '@almari/shared/types';

/**
 * CONVERSATIONS — one group and a thread per pair.
 *
 * A look or a piece can ride along with a message; it is attached as a snapshot,
 * the same way a feed post carries one, because the person reading it cannot
 * open your closet. Borrow requests use the states the Shared Rail already
 * established, and a declined request stays a neutral fact — "Staying home" —
 * because a piece not going out is not a verdict on whoever asked.
 */

const STATUS_LABELS: Record<BorrowStatus, string> = {
  asked: 'Asked',
  lent: 'Lent',
  declined: 'Staying home',
  returned: 'Home again',
};

/** How many closet pieces the send-a-piece grid shows before it says so. */
const PIECE_PICKER_LIMIT = 60;

/**
 * What a feed card sends along when a verb points here (social.tsx, PostCard):
 * Attach carries a snapshot, Ask carries the piece's name and its owner. This
 * page never consumed those — Attach and Ask from the feed silently dropped.
 * The native app defined and tested the receiving contract; this is its web
 * half, the same shapes. A malformed state is no arrival, never a crash.
 */
type ChatArrival = {
  attach?: { look?: SharedLook; piece?: SharedPiece };
  ask?: { pieceName: string; ownerId: string };
};

function readArrival(state: unknown): ChatArrival | null {
  if (!state || typeof state !== 'object') return null;
  const s = state as Record<string, unknown>;
  const out: ChatArrival = {};
  if (s.attach && typeof s.attach === 'object') {
    const a = s.attach as Record<string, unknown>;
    if (a.look && typeof a.look === 'object') out.attach = { look: a.look as SharedLook };
    else if (a.piece && typeof a.piece === 'object') out.attach = { piece: a.piece as SharedPiece };
  }
  if (s.ask && typeof s.ask === 'object') {
    const k = s.ask as Record<string, unknown>;
    if (typeof k.pieceName === 'string' && typeof k.ownerId === 'string') {
      out.ask = { pieceName: k.pieceName, ownerId: k.ownerId };
    }
  }
  return out.attach || out.ask ? out : null;
}

export default function Chats() {
  const { accounts, community, setCommunity, activeId } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  // A verb from the feed lands here first; the thing it carries rides along
  // until a conversation is chosen for it.
  const arrival = readArrival(location.state);
  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const [starting, setStarting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const others = accounts.filter(a => a.id !== activeId);

  /** One person selected makes a direct thread; two or more makes a group. */
  const startConversation = () => {
    if (!activeId || picked.length === 0) return;
    const memberIds = [activeId, ...picked];
    const isGroup = picked.length > 1;
    // A pair already talking should not end up with two threads.
    const existing = community.conversations.find(
      c => !c.isGroup && c.memberIds.length === memberIds.length &&
        memberIds.every(m => c.memberIds.includes(m))
    );
    if (existing && !isGroup) {
      setStarting(false);
      // The ticks were cleared on the other branch only, so reopening the
      // modal after landing on an existing thread showed a stale selection.
      setPicked([]);
      setGroupName('');
      navigate(`/chats/${existing.id}`, { state: arrival ?? undefined });
      return;
    }
    const id = `c-${crypto.randomUUID().slice(0, 8)}`;
    setCommunity(prev => ({
      ...prev,
      conversations: [
        ...prev.conversations,
        {
          id,
          memberIds,
          isGroup,
          name: isGroup ? (groupName.trim() || picked.map(p => byId.get(p)?.name).filter(Boolean).join(', ')) : undefined,
        },
      ],
    }));
    setStarting(false);
    setPicked([]);
    setGroupName('');
    navigate(`/chats/${id}`, { state: arrival ?? undefined });
  };

  const threads = useMemo(() => {
    return community.conversations
      .filter(c => c.memberIds.includes(activeId ?? ''))
      .map(c => {
        const messages = community.messages
          .filter(m => m.conversationId === c.id)
          .sort(oldestFirst);
        return { conversation: c, last: messages[messages.length - 1], count: messages.length };
      })
      // Sub-day stamp first: two threads active on the same day used to fall
      // through to whichever message id sorted first, and the list reshuffled.
      .sort((a, b) =>
        (b.last?.at ?? b.last?.date ?? '').localeCompare(a.last?.at ?? a.last?.date ?? ''));
  }, [community, activeId]);

  // The new-conversation modal has to be reachable from the empty screen too —
  // the first thread starts from exactly there — so both branches share one tree.
  return (
    <div className="space-y-6">
      <Masthead
        title="Conversations"
        meta={threads.length > 0 ? `${threads.length} open` : undefined}
        action={threads.length > 0 && others.length > 0 ? (
          <Button tone="primary" icon={<IconPlus size={16} />} onClick={() => setStarting(true)}>New</Button>
        ) : undefined}
      />
      {arrival ? (
        <Card>
          <p className="text-[14px] text-text-2 leading-snug">
            Riding along:{' '}
            {arrival.ask
              ? `asking after the ${arrival.ask.pieceName}`
              : arrival.attach?.look
                ? `“${arrival.attach.look.name}”`
                : `“${arrival.attach?.piece?.name ?? 'a piece'}”`}
            . Choose the conversation for it.
          </p>
        </Card>
      ) : null}
      {threads.length === 0 ? (
        <Card>
          <EmptyState
            plate={<PlateEmptyWishlist />}
            title="No conversations yet."
            body="Threads between the wardrobes on this device: ask after a piece, send a look, say when something came home. None of it leaves."
            action={
              // Alone on the device there is no one to write to; the way in is a household.
              others.length > 0 ? (
                <Button tone="primary" onClick={() => setStarting(true)}>Start one</Button>
              ) : (
                <LinkButton to="/profile" tone="primary" wrap>Join wardrobes under a roof</LinkButton>
              )
            }
          />
        </Card>
      ) : (
      <Card>
        <SectionTitle aside="most recent first">Threads</SectionTitle>
        <ul>
          {threads.map(({ conversation, last, count }) => {
            const others = conversation.memberIds.filter(id => id !== activeId).map(id => byId.get(id));
            const title = conversation.isGroup
              ? conversation.name ?? 'The group'
              : others[0]?.name ?? 'Someone';
            return (
              <li key={conversation.id}>
                <Link to={`/chats/${conversation.id}`} state={arrival ?? undefined} className="flex items-center gap-3 min-h-[64px] py-2 group">
                  <span className="flex -space-x-2 shrink-0">
                    {others.slice(0, 2).map(a => a ? <AccountMark key={a.id} account={a} size={28} /> : null)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-text truncate group-hover:underline underline-offset-[3px]">
                      {title}
                    </span>
                    {/* Prose stays prose — mono caps is for the ledger, and the
                        hard slice(0,60) cut words mid-letter with no ellipsis
                        while `truncate` was already sitting here doing the job. */}
                    <span className="text-[13px] text-text-2 block mt-0.5 truncate">
                      {last ? `${byId.get(last.authorId)?.handle ?? ''} · ${last.text}` : 'No messages yet'}
                    </span>
                  </span>
                  <span className="type-ledger text-[11px] text-text-2 tabular shrink-0">
                    {last ? shortDate(last.date) : ''} · {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
      )}

      <Modal open={starting} onClose={() => setStarting(false)} title="New conversation">
        <p className="text-[13px] text-text-2 leading-relaxed">
          Pick one wardrobe for a direct thread, or several for a group.
        </p>
        <ul className="mt-4">
          {others.map(account => {
            const on = picked.includes(account.id);
            return (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => setPicked(p => on ? p.filter(x => x !== account.id) : [...p, account.id])}
                  aria-pressed={on}
                  className={`w-full flex items-center gap-3 min-h-[56px] px-2 text-left rounded-[2px] border ${
                    on ? 'border-text bg-sunken' : 'border-transparent'
                  }`}
                >
                  <AccountMark account={account} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-text truncate">{account.name}</span>
                    <span className="type-ledger text-[11px] text-text-2">{account.handle}</span>
                  </span>
                  {on ? <span className="type-ledger text-[11px] text-text-2">in</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {picked.length > 1 ? (
          <div className="mt-4">
            <Field label="Name this group" htmlFor="group-name" hint="Optional. Their names are used otherwise.">
              <input id="group-name" className={inputClass} value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="The Rail" />
            </Field>
          </div>
        ) : null}
        <div className="flex items-center gap-3 mt-6">
          <Button tone="primary" disabled={picked.length === 0} onClick={startConversation}>
            {picked.length > 1 ? 'Start the group' : 'Start it'}
          </Button>
          <Button tone="tertiary" onClick={() => setStarting(false)}>Not now</Button>
        </div>
      </Modal>
    </div>
  );
}

export function ChatThread() {
  const { id } = useParams<{ id: string }>();
  const { accounts, community, setCommunity, activeId } = useSession();
  const { outfits, activeItems, getItem, recordLoan, closeLoan } = useWardrobe();
  const location = useLocation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [attaching, setAttaching] = useState<null | 'look' | 'piece'>(null);
  const [attached, setAttached] = useState<{ look?: SharedLook; piece?: SharedPiece }>({});
  const [asking, setAsking] = useState(false);
  const [askPiece, setAskPiece] = useState('');
  const [askOwner, setAskOwner] = useState('');
  const [askNote, setAskNote] = useState('');

  // The arrival a feed verb sent along is consumed exactly once: the snapshot
  // lands in the composer, or the ask sheet opens prefilled. The state is
  // then cleared so back or refresh does not re-arm it.
  const consumedArrival = useRef(false);
  useEffect(() => {
    const arrival = readArrival(location.state);
    if (consumedArrival.current || !arrival) return;
    consumedArrival.current = true;
    if (arrival.attach) setAttached(arrival.attach);
    if (arrival.ask) {
      setAsking(true);
      setAskPiece(arrival.ask.pieceName);
      setAskOwner(arrival.ask.ownerId);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const found = community.conversations.find(c => c.id === id);
  /**
   * Membership, checked in one place.
   *
   * There was no check at all: typing another pair's conversation id opened
   * their entire thread with a live compose box, and a message sent from there
   * landed in their conversation while never appearing in the sender's own
   * list. A thread you are not in must read the same as a thread that is gone.
   */
  const conversation = found && activeId && found.memberIds.includes(activeId) ? found : undefined;
  const messages = useMemo(
    () => community.messages
      .filter(m => m.conversationId === id)
      // oldestFirst tolerates an undated message; the raw comparator threw on
      // one and blanked the page.
      .sort(oldestFirst),
    [community.messages, id]
  );

  if (!conversation || !activeId) {
    return (
      <>
        <Masthead title="Conversations" />
        <Card>
          <EmptyState
            plate={<PlateEmptyWishlist />}
            title="No record of this thread."
            body="It may have been removed, or it never existed on this device."
            action={<LinkButton to="/chats" tone="primary" icon={<IconChevronLeft size={16} />}>Back to conversations</LinkButton>}
          />
        </Card>
      </>
    );
  }

  // `withYou`, not `others` — the page-level list of every other wardrobe is
  // also called `others`, and this was shadowing it.
  const withYou = conversation.memberIds.filter(m => m !== activeId).map(m => byId.get(m));
  const present = withYou.filter(Boolean);
  const title = conversation.isGroup ? conversation.name ?? 'The group' : withYou[0]?.name ?? 'Someone';

  const send = () => {
    if (!draft.trim() && !attached.look && !attached.piece) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      authorId: activeId,
      date: todayLocal(),
      at: nowLocalStamp(),
      text: draft.trim(),
      look: attached.look,
      piece: attached.piece,
    };
    setCommunity(prev => ({ ...prev, messages: [...prev.messages, message] }));
    setDraft('');
    setAttached({});
  };

  /**
   * A request is always between two wardrobes — the asker and the owner — even
   * when it is written in a group, which is why the owner has to be named. A
   * question to the room ("has anyone got a black coat") is just a message.
   */
  const ask = () => {
    if (!activeId || !askPiece.trim() || !askOwner) return;
    const owner = byId.get(askOwner);
    setCommunity(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          id: crypto.randomUUID(),
          conversationId: conversation.id,
          authorId: activeId,
          date: todayLocal(),
          at: nowLocalStamp(),
          text: askNote.trim() || `Asking after the ${askPiece.trim()}${owner ? `, ${owner.name}` : ''}.`,
          request: { pieceName: askPiece.trim(), status: 'asked' as const, ownerId: askOwner },
        },
      ],
    }));
    setAsking(false);
    setAskPiece('');
    setAskNote('');
  };

  const advance = (messageId: string, status: BorrowStatus) => {
    setCommunity(prev => ({
      ...prev,
      messages: prev.messages.map(m =>
        m.id === messageId && m.request ? { ...m, request: { ...m.request, status } } : m
      ),
    }));
    /* The rail keeps the ledger. An accepted request opens a loan in the open
       wardrobe's own circle; "home again" closes it. Only the owner ever sees
       these buttons, so the lending side is always the wardrobe doing the
       writing — the borrower's own rail learns of it the day their app writes
       their half, which no code path may do from here. */
    const message = community.messages.find(m => m.id === messageId);
    const other = message ? byId.get(message.authorId) : undefined;
    const me = accounts.find(a => a.id === activeId);
    if (!message?.request || !me || !other) return;
    if (status === 'lent') recordLoan(message.request.pieceName, me, other);
    if (status === 'returned') closeLoan(message.request.pieceName, other.id);
  };

  return (
    <div className="space-y-6">
      <Masthead
        title={title}
        meta={conversation.isGroup ? `${conversation.memberIds.length} wardrobes` : withYou[0]?.handle}
        // The way out used to be forty messages down the page.
        action={
          <LinkButton to="/chats" compact icon={<IconChevronLeft size={16} />}>Conversations</LinkButton>
        }
      />
      {conversation.about ? (
        <p className="type-editorial text-[19px] leading-snug text-balance -mt-2">{conversation.about}</p>
      ) : null}

      <Card>
        <ul className="space-y-5">
          {messages.map(message => {
            const author = byId.get(message.authorId);
            return (
              <li key={message.id} className="flex gap-3">
                {author ? <AccountMark account={author} size={26} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="type-ledger text-[11px] text-text-2">
                    {author?.name ?? 'Someone'}
                    <span className="mx-1.5">·</span>
                    <span className="tabular">{shortDate(message.date)}</span>
                  </p>
                  {message.text ? (
                    <p className="text-[15px] text-text mt-1 leading-relaxed">{message.text}</p>
                  ) : null}

                  {message.look ? <div className="mt-2 max-w-[280px]"><LookCard look={message.look} compact /></div> : null}
                  {message.piece ? <div className="mt-2 max-w-[280px]"><PieceCard piece={message.piece} /></div> : null}

                  {message.request ? (
                    <div className="border border-border rounded-[2px] px-3 py-2.5 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="text-[14px] text-text">{message.request.pieceName}</span>
                      <span className="type-ledger text-[11px] text-text-2">
                        {/* A status we do not have a label for is written as it
                            stands, rather than leaving an empty gap. */}
                        {STATUS_LABELS[message.request.status] ?? message.request.status}
                      </span>
                      {message.request.ownerId === activeId && message.request.status === 'asked' ? (
                        // The pair needs 232px and has 229px even at 390px, so
                        // without wrapping it spilled past its own bubble.
                        <span className="flex flex-wrap items-center gap-2 ml-auto">
                          <Button compact onClick={() => advance(message.id, 'lent')}>Lend it</Button>
                          <Button compact onClick={() => advance(message.id, 'declined')}>It stays home</Button>
                        </span>
                      ) : null}
                      {message.request.ownerId === activeId && message.request.status === 'lent' ? (
                        <span className="ml-auto">
                          <Button compact onClick={() => advance(message.id, 'returned')}>Mark returned</Button>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <Basting className="my-4" />

        {attached.look ? (
          <div className="mb-3 max-w-[280px]">
            <LookCard look={attached.look} compact />
            <Button tone="tertiary" onClick={() => setAttached({})}>Take it off</Button>
          </div>
        ) : null}
        {attached.piece ? (
          <div className="mb-3 max-w-[280px]">
            <PieceCard piece={attached.piece} />
            <Button tone="tertiary" onClick={() => setAttached({})}>Take it off</Button>
          </div>
        ) : null}

        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); send(); }}>
          <label htmlFor="chat-draft" className="sr-only">Write a message</label>
          <input
            id="chat-draft"
            className={`${inputClass} flex-1 min-w-[180px]`}
            placeholder="Ask after a piece, or send a look"
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          {/* Hidden when nobody in the thread is still on the device: the modal
              opened onto an empty picker with Ask permanently disabled. */}
          {present.length > 0 ? (
            <Button type="button" compact onClick={() => { setAskOwner(present[0]?.id ?? ''); setAsking(true); }}>
              Ask after a piece
            </Button>
          ) : null}
          <Button type="button" compact onClick={() => setAttaching('look')}>Attach a look</Button>
          <Button type="button" compact onClick={() => setAttaching('piece')}>Attach a piece</Button>
          <Button tone="primary" type="submit" disabled={!draft.trim() && !attached.look && !attached.piece}>
            Send
          </Button>
        </form>
      </Card>

      <Modal open={asking} onClose={() => setAsking(false)} title="Ask after a piece">
        <p className="text-[13px] text-text-2 leading-relaxed">
          A request goes to one person, so their wardrobe is the one that can answer it. To ask the
          room in general, just write a message.
        </p>
        <div className="space-y-5 mt-5">
          <Field label="Whose piece" htmlFor="ask-owner">
            <select id="ask-owner" className={selectClass} value={askOwner} onChange={e => setAskOwner(e.target.value)}>
              {present.map(a => <option key={a!.id} value={a!.id}>{a!.name}</option>)}
            </select>
          </Field>
          <Field label="Which piece" htmlFor="ask-piece" hint="As they would call it.">
            <input id="ask-piece" className={inputClass} value={askPiece} onChange={e => setAskPiece(e.target.value)} placeholder="The ivory bandhgala" />
          </Field>
          <Field label="A line with it" htmlFor="ask-note" hint="Optional. What it is for, and when it comes back.">
            <input id="ask-note" className={inputClass} value={askNote} onChange={e => setAskNote(e.target.value)} placeholder="Wedding on the 30th, home by the 2nd" />
          </Field>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <Button tone="primary" disabled={!askPiece.trim() || !askOwner} onClick={ask}>Ask</Button>
          <Button tone="tertiary" onClick={() => setAsking(false)}>Not now</Button>
        </div>
      </Modal>

      <Modal open={attaching === 'look'} onClose={() => setAttaching(null)} title="Send a look" wide>
        {outfits.length === 0 ? (
          <p className="text-[14px] text-text-2 leading-snug">
            No looks saved yet. Put one together in Outfits and it will be here to send.
          </p>
        ) : null}
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {outfits.map(outfit => (
            <li key={outfit.id}>
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => {
                  setAttached({
                    look: {
                      outfitId: outfit.id,
                      name: outfit.name,
                      imageUrl: outfit.imageUrl,
                      occasion: outfit.occasion,
                      pieces: outfit.itemIds.map(i => getItem(i)?.name).filter((n): n is string => Boolean(n)),
                    },
                  });
                  setAttaching(null);
                }}
              >
                <LookCard look={{ outfitId: outfit.id, name: outfit.name, imageUrl: outfit.imageUrl, occasion: outfit.occasion, pieces: [] }} />
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal open={attaching === 'piece'} onClose={() => setAttaching(null)} title="Send a piece" wide>
        {activeItems.length === 0 ? (
          <p className="text-[14px] text-text-2 leading-snug">
            The closet is empty. Add a piece and it will be here to send.
          </p>
        ) : null}
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {activeItems.slice(0, PIECE_PICKER_LIMIT).map(item => (
            <li key={item.id}>
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => {
                  setAttached({
                    piece: { itemId: item.id, name: item.name, imageUrl: item.imageUrl, category: item.category, color: item.color },
                  });
                  setAttaching(null);
                }}
              >
                <PieceCard piece={{ itemId: item.id, name: item.name, imageUrl: item.imageUrl, category: item.category, color: item.color }} />
              </button>
            </li>
          ))}
        </ul>
        {/* No silent caps: a closet larger than the picker should say so rather
            than quietly present the first sixty as if they were all of it. */}
        {activeItems.length > PIECE_PICKER_LIMIT ? (
          <p className="type-ledger text-[11px] text-text-2 mt-4">
            Showing {PIECE_PICKER_LIMIT} of {activeItems.length}. Search the closet for the rest.
          </p>
        ) : null}
      </Modal>

      <p>
        <Link to="/chats" className="type-label text-[13px] text-text-2 hover:text-text inline-flex items-center gap-1.5 min-h-11">
          <IconChevronLeft size={16} />
          Back to conversations
        </Link>
      </p>
    </div>
  );
}
