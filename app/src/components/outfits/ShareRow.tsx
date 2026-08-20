/**
 * SHOW THIS LOOK — the Look Book's verb, on the look itself.
 *
 * THE WHOLE FILE IS BEHIND FEED_ENABLED and the gate is at the call site
 * (app/src/app/outfits/[id].tsx), not in here: with the flag off this
 * component is never rendered, so its hook never runs and the shared shelf is
 * never opened by a room that has nowhere to send anything. A Share whose
 * destination is not in the house this season is a promise the app cannot
 * keep — the web's own reason for the same gate (src/pages/Outfits.tsx).
 *
 * THE FEED ALREADY POINTS HERE. Its plaque reads "Sharing happens one look at
 * a time, from the outfit itself" (app/src/app/(tabs)/feed.tsx), and until
 * this row existed that sentence named a door nobody had built. It is built to
 * the same store the feed reads and to the web's own post shape, so a wardrobe
 * that shares on the phone and opens on the laptop finds the same post.
 *
 * FOUR RULES FROM .claude/skills/toile-social/SKILL.md, each with its line:
 *
 *  1. A SHARED LOOK IS A SNAPSHOT (§4) — name, occasion and PIECE NAMES are
 *     copied at the moment of sharing. Nothing here stores a live reference
 *     into this wardrobe, so a look amended tomorrow does not silently rewrite
 *     what somebody was shown today, and consent is structural rather than a
 *     filter one refactor away from leaking.
 *  2. NO METRICS (§3) — no view count, no "seen by", no rank. The row states
 *     one of two facts: on the feed, or not shared.
 *  3. THE SCOPE IS CHOSEN, NOT ASSUMED. Two scopes are offered because two are
 *     what this app can honestly honour today: everyone on this device, or
 *     this wardrobe alone. Conversations and households are real scopes in the
 *     shared type, and native has no surface that could pick one, so this
 *     sheet does not pretend to.
 *  4. TAKING IT DOWN LEAVES A TOMBSTONE, exactly as the feed's own take-down
 *     does — a reseed re-appends any known-id post it merely finds missing, so
 *     "taken off" has to be recorded as more than an absence.
 */
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { todayLocal } from '@almari/shared/dates';
import { SCOPE_LABELS, type ClothingItem, type Outfit, type ShareScope } from '@almari/shared/types';

import { Button } from '../Button';
import { Chip } from '../Chip';
import { showToast } from '../Toast';
import { nowLocalStamp } from '../chats/format';
import { useCommunity } from '../feed/communityStore';
import { ConfirmSheet } from '../feed/ConfirmSheet';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/** The scopes native can honestly honour. Labels come from the shared type. */
const SCOPES: ShareScope[] = [{ kind: 'everyone' }, { kind: 'self' }];

/** Post ids are opaque; Hermes ships no crypto.randomUUID (lib/photos.ts). */
function mintPostId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `p-${Date.now().toString(36)}-${rand()}`;
}

/** Who a scope lets in, said plainly rather than as a label to decode. */
function whoSees(scope: ShareScope): string {
  return scope.kind === 'everyone'
    ? 'Every wardrobe on this device can see it.'
    : 'It stays on your own profile and nowhere else.';
}

export function ShareRow({ look, members }: { look: Outfit; members: ClothingItem[] }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const { community, activeId, setCommunity } = useCommunity();
  const [sharing, setSharing] = useState(false);
  const [takingOff, setTakingOff] = useState(false);
  const [scope, setScope] = useState<ShareScope>(SCOPES[0]);
  const [caption, setCaption] = useState('');

  /**
   * Answered from the shared store, never from a flag on the look. A
   * duplicated index is one desync away from telling somebody something false
   * about what of theirs is visible.
   */
  const posted = useMemo(
    () =>
      community?.posts.find(p => p.authorId === activeId && p.look?.outfitId === look.id) ?? null,
    [community?.posts, activeId, look.id],
  );

  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };

  // The shelf has not answered yet: a blank beat, not a control that might be
  // about to change its mind.
  if (community === null || activeId === null) return null;

  const share = () => {
    setCommunity(prev => ({
      ...prev,
      posts: [
        ...prev.posts,
        {
          id: mintPostId(),
          authorId: activeId,
          date: todayLocal(),
          // The sub-day stamp is the same-day tiebreak; without it two looks
          // shared one afternoon sort by a random id.
          at: nowLocalStamp(),
          caption: caption.trim().length > 0 ? caption.trim() : undefined,
          scope,
          look: {
            outfitId: look.id,
            name: look.name,
            imageUrl: look.imageUrl,
            occasion: look.occasion,
            // NAMES ONLY. A viewer cannot open somebody else's pieces, and the
            // snapshot must stay true after the look itself changes.
            pieces: members.map(m => m.name),
          },
        },
      ],
    }));
    setSharing(false);
    setCaption('');
    showToast(`On the feed. ${whoSees(scope)}`, 'seal');
  };

  const takeOff = () => {
    if (!posted) return;
    const id = posted.id;
    setCommunity(prev => ({
      ...prev,
      posts: prev.posts.filter(p => p.id !== id),
      removedPostIds: [...(prev.removedPostIds ?? []), id],
      savedPostIds: (prev.savedPostIds ?? []).filter(x => x !== id),
    }));
    setTakingOff(false);
    showToast('Taken off the feed. The look stays in your outfits.', 'info');
  };

  return (
    <View style={styles.row}>
      <Text style={ledger}>{posted ? 'On the feed' : 'Not shared'}</Text>
      {/* Tertiary, never a second bordered box: the log action is the one
          bordered control on this screen (brand law 3). */}
      <Button tone="tertiary" onPress={() => (posted ? setTakingOff(true) : setSharing(true))}>
        {posted ? 'Take it off the feed' : 'Share this look'}
      </Button>

      <ConfirmSheet
        open={takingOff}
        title="Take it off the feed"
        body={`This takes “${look.name}” off the feed for every wardrobe here, and it will not come back on its own. The look itself stays in your outfits.`}
        confirmLabel="Take it off"
        onConfirm={takeOff}
        onClose={() => setTakingOff(false)}
      />

      {/* The share plate. Its own modal rather than a ConfirmSheet, because a
          scope is a choice and a confirm has only a yes. */}
      <Modal visible={sharing} transparent animationType="fade" onRequestClose={() => setSharing(false)}>
        <Pressable
          style={[styles.scrim, { backgroundColor: `${tokens.bgDeep}CC` }]}
          onPress={() => setSharing(false)}
          accessibilityLabel="Close"
        >
          <Pressable
            onPress={() => undefined}
            style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.text }]}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text accessibilityRole="header" style={[ledger, { color: tokens.text }]}>
                Share this look
              </Text>
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: TYPE.body,
                  lineHeight: Math.round(TYPE.body * 1.5),
                  color: tokens.text,
                  marginTop: 12,
                }}
              >
                A copy of “{look.name}” goes on the feed — its name, what it is for, and the names of
                the pieces in it. The pieces themselves stay here, and amending the look later does
                not change what was shown.
              </Text>

              <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>Who can see it</Text>
              <View style={styles.chips}>
                {SCOPES.map(option => (
                  <Chip
                    key={option.kind}
                    selected={scope.kind === option.kind}
                    onPress={() => setScope(option)}
                  >
                    {SCOPE_LABELS[option.kind]}
                  </Chip>
                ))}
              </View>
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 13,
                  lineHeight: 19,
                  color: tokens.text2,
                  marginTop: 10,
                }}
              >
                {whoSees(scope)}
              </Text>

              <Text style={[ledger, { marginTop: 20, marginBottom: 8 }]}>
                A line about it — optional
              </Text>
              <TextInput
                accessibilityLabel="A line about it"
                value={caption}
                onChangeText={setCaption}
                placeholder="A look can speak for itself"
                placeholderTextColor={tokens.text2}
                style={{
                  fontFamily: fonts.ui,
                  fontSize: TYPE.body,
                  color: tokens.text,
                  minHeight: 44,
                  paddingHorizontal: 12,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: tokens.border,
                  borderRadius: RADIUS,
                  backgroundColor: tokens.surface,
                }}
              />

              <View style={styles.footer}>
                <Button tone="tertiary" onPress={() => setSharing(false)}>
                  Not now
                </Button>
                <Button tone="primary" onPress={share}>
                  Share it
                </Button>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  plate: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
});
