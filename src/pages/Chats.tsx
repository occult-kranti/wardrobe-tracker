import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useWardrobe } from '../context/WardrobeContext';
import { Button, Card, EmptyState, Masthead, Modal, SectionTitle, inputClass } from '../components/ui';
import { Basting, PlateEmptyWishlist } from '../components/art';
import { IconChevronLeft } from '../components/icons';
import { AccountMark, LookCard, PieceCard, shortDate } from '../components/social';
import { todayLocal } from '../lib/dates';
import type { BorrowStatus, ChatMessage, SharedLook, SharedPiece } from '../types';

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

export default function Chats() {
  const { accounts, community, activeId } = useSession();
  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);

  const threads = useMemo(() => {
    return community.conversations
      .filter(c => c.memberIds.includes(activeId ?? ''))
      .map(c => {
        const messages = community.messages
          .filter(m => m.conversationId === c.id)
          .sort((a, b) => a.date.localeCompare(b.date));
        return { conversation: c, last: messages[messages.length - 1], count: messages.length };
      })
      .sort((a, b) => (b.last?.date ?? '').localeCompare(a.last?.date ?? ''));
  }, [community, activeId]);

  if (threads.length === 0) {
    return (
      <>
        <Masthead title="Conversations" />
        <Card>
          <EmptyState
            plate={<PlateEmptyWishlist />}
            title="No conversations yet."
            body="Threads between the wardrobes on this device — for asking after a piece, sending a look, and saying when it came home. All of it stays on this device."
          />
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <Masthead title="Conversations" meta={`${threads.length} open`} />
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
                <Link to={`/chats/${conversation.id}`} className="flex items-center gap-3 min-h-[64px] py-2 group">
                  <span className="flex -space-x-2 shrink-0">
                    {others.slice(0, 2).map(a => a ? <AccountMark key={a.id} account={a} size={28} /> : null)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-text truncate group-hover:underline underline-offset-[3px]">
                      {title}
                    </span>
                    <span className="type-ledger text-[11px] text-text-2 block mt-0.5 truncate">
                      {last ? `${byId.get(last.authorId)?.handle ?? ''} · ${last.text.slice(0, 60)}` : 'No messages yet'}
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
    </div>
  );
}

export function ChatThread() {
  const { id } = useParams<{ id: string }>();
  const { accounts, community, setCommunity, activeId } = useSession();
  const { outfits, activeItems, getItem } = useWardrobe();
  const [draft, setDraft] = useState('');
  const [attaching, setAttaching] = useState<null | 'look' | 'piece'>(null);
  const [attached, setAttached] = useState<{ look?: SharedLook; piece?: SharedPiece }>({});

  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const conversation = community.conversations.find(c => c.id === id);
  const messages = useMemo(
    () => community.messages
      .filter(m => m.conversationId === id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
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
            action={<Link to="/chats"><Button tone="primary" icon={<IconChevronLeft size={16} />}>Back to conversations</Button></Link>}
          />
        </Card>
      </>
    );
  }

  const others = conversation.memberIds.filter(m => m !== activeId).map(m => byId.get(m));
  const title = conversation.isGroup ? conversation.name ?? 'The group' : others[0]?.name ?? 'Someone';

  const send = () => {
    if (!draft.trim() && !attached.look && !attached.piece) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      authorId: activeId,
      date: todayLocal(),
      text: draft.trim(),
      look: attached.look,
      piece: attached.piece,
    };
    setCommunity(prev => ({ ...prev, messages: [...prev.messages, message] }));
    setDraft('');
    setAttached({});
  };

  const advance = (messageId: string, status: BorrowStatus) => {
    setCommunity(prev => ({
      ...prev,
      messages: prev.messages.map(m =>
        m.id === messageId && m.request ? { ...m, request: { ...m.request, status } } : m
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <Masthead
        title={title}
        meta={conversation.isGroup ? `${conversation.memberIds.length} wardrobes` : others[0]?.handle}
      />
      {conversation.about ? (
        <p className="type-editorial text-[19px] leading-snug text-balance -mt-2">{conversation.about}</p>
      ) : null}

      <Card>
        <ul className="space-y-5">
          {messages.map(message => {
            const author = byId.get(message.authorId);
            const mine = message.authorId === activeId;
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
                        {STATUS_LABELS[message.request.status]}
                      </span>
                      {!mine && message.request.status === 'asked' ? (
                        <span className="flex items-center gap-2 ml-auto">
                          <Button compact onClick={() => advance(message.id, 'lent')}>Lend it</Button>
                          <Button compact onClick={() => advance(message.id, 'declined')}>It stays home</Button>
                        </span>
                      ) : null}
                      {!mine && message.request.status === 'lent' ? (
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
            <button type="button" onClick={() => setAttached({})} className="type-ledger text-[11px] text-accent underline underline-offset-[3px] min-h-11">
              Take it off
            </button>
          </div>
        ) : null}
        {attached.piece ? (
          <div className="mb-3 max-w-[280px]">
            <PieceCard piece={attached.piece} />
            <button type="button" onClick={() => setAttached({})} className="type-ledger text-[11px] text-accent underline underline-offset-[3px] min-h-11">
              Take it off
            </button>
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
          <Button type="button" compact onClick={() => setAttaching('look')}>Attach a look</Button>
          <Button type="button" compact onClick={() => setAttaching('piece')}>Attach a piece</Button>
          <Button tone="primary" type="submit" disabled={!draft.trim() && !attached.look && !attached.piece}>
            Send
          </Button>
        </form>
      </Card>

      <Modal open={attaching === 'look'} onClose={() => setAttaching(null)} title="Send a look" wide>
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
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {activeItems.slice(0, 60).map(item => (
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
