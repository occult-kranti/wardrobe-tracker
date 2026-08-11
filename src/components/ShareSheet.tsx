import { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { Button, Field, Modal, inputClass, selectClass } from './ui';
import { Basting } from './art';
import { LookCard } from './social';
import { SCOPE_LABELS, type ShareScope, type SharedLook } from '../types';

/**
 * Putting a look on the feed, and saying who it is for.
 *
 * The preview is the real feed row, not a mock, so nobody has to guess what
 * they are about to show. The scopes are stated as what they are — labels on a
 * shelf every wardrobe on this device can read — because implying an
 * enforcement the storage cannot perform would be the first lie the app tells.
 */

const SCOPE_HINTS: Record<ShareScope['kind'], string> = {
  everyone: 'Every wardrobe on this device.',
  conversation: 'The people in one thread.',
  person: 'One wardrobe, and no other.',
  self: 'It stays on your own profile and nowhere else.',
};

export function ShareSheet({
  open,
  look,
  initialScope,
  initialCaption,
  onClose,
  onShare,
}: {
  open: boolean;
  look: SharedLook | null;
  initialScope?: ShareScope;
  initialCaption?: string;
  onClose: () => void;
  onShare: (scope: ShareScope, caption: string) => void;
}) {
  const { accounts, community, activeId } = useSession();
  const [scope, setScope] = useState<ShareScope>(initialScope ?? { kind: 'everyone' });
  const [caption, setCaption] = useState(initialCaption ?? '');

  const others = accounts.filter(a => a.id !== activeId);
  const threads = community.conversations.filter(c => c.memberIds.includes(activeId ?? ''));

  if (!look) return null;

  const kinds: ShareScope['kind'][] = ['everyone', 'conversation', 'person', 'self'];

  const pick = (kind: ShareScope['kind']) => {
    if (kind === 'everyone') setScope({ kind: 'everyone' });
    else if (kind === 'self') setScope({ kind: 'self' });
    else if (kind === 'conversation') setScope({ kind: 'conversation', conversationId: threads[0]?.id ?? '' });
    else setScope({ kind: 'person', accountId: others[0]?.id ?? '' });
  };

  const ready =
    scope.kind !== 'conversation' && scope.kind !== 'person'
      ? true
      : scope.kind === 'conversation'
        ? Boolean(scope.conversationId)
        : Boolean(scope.accountId);

  return (
    <Modal open={open} onClose={onClose} title="Put this on the feed">
      <p className="text-[13px] text-text-2 leading-relaxed">This is exactly what the feed will show.</p>
      <div className="mt-3 max-w-[300px]">
        <LookCard look={look} />
      </div>

      <Basting className="my-4" />

      <Field label="Who sees it">
        <div className="space-y-1">
          {kinds.map(kind => {
            // A scope with nobody to point at is not offered.
            if (kind === 'conversation' && threads.length === 0) return null;
            if (kind === 'person' && others.length === 0) return null;
            const active = scope.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => pick(kind)}
                aria-pressed={active}
                className={`w-full flex items-baseline gap-3 min-h-11 px-3 text-left rounded-[2px] border transition-colors duration-150 ${
                  active ? 'border-text bg-sunken text-text' : 'border-transparent text-text-2 hover:text-text'
                }`}
              >
                <span className="text-[15px]">{SCOPE_LABELS[kind]}</span>
                <span className="type-ledger text-[11px] text-text-2">{SCOPE_HINTS[kind]}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {scope.kind === 'person' ? (
        <div className="mt-4">
          <Field label="Which wardrobe" htmlFor="share-person">
            <select
              id="share-person"
              className={selectClass}
              value={scope.accountId}
              onChange={e => setScope({ kind: 'person', accountId: e.target.value })}
            >
              {others.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {scope.kind === 'conversation' ? (
        <div className="mt-4">
          <Field label="Which conversation" htmlFor="share-thread">
            <select
              id="share-thread"
              className={selectClass}
              value={scope.conversationId}
              onChange={e => setScope({ kind: 'conversation', conversationId: e.target.value })}
            >
              {threads.map(t => (
                <option key={t.id} value={t.id}>
                  {t.isGroup
                    ? t.name ?? 'The group'
                    : accounts.find(a => t.memberIds.includes(a.id) && a.id !== activeId)?.name ?? 'A thread'}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <div className="mt-5">
        <Field label="A line with it" htmlFor="share-caption" hint="Optional. What it was for, or what it did.">
          <input
            id="share-caption"
            className={inputClass}
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Held up all evening"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <Button tone="primary" disabled={!ready} onClick={() => onShare(scope, caption.trim())}>
          Put it on the feed
        </Button>
        <Button tone="tertiary" onClick={onClose}>Not now</Button>
      </div>

      <p className="type-ledger text-[11px] text-text-2 mt-4 leading-relaxed">
        Everything here is one file on this device. Scopes say who a look is meant for; they are
        labels on a shared shelf, not locks.
      </p>
    </Modal>
  );
}
