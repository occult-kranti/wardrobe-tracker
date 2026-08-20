/**
 * LOOK BOOK — the living feed, ported from src/pages/Feed.tsx (docs/34 §2.2).
 *
 * Deliberately not a performance surface: no likes, no counts, no followers,
 * no "seen by", no unread marks, no ranking. Posts are in the order they were
 * shared, newest first, and that is the whole algorithm. The one engagement
 * mechanic is the set-aside mark — private to this device, counted nowhere.
 *
 * Alpha scope (docs/40 §3, restated for native): the reader's own shared
 * looks plus the sample content, local only, zero network. Sample posts say
 * they are samples on every card; their photographs are web-relative
 * snapshots the phone cannot reach, so each renders as its typographic
 * specimen (the asset seam, docs/34 §2.8).
 */
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { FeedPost } from '@almari/shared/types';

import { Chip } from '../../components/Chip';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { useCommunity } from '../../components/feed/communityStore';
import { ConfirmSheet } from '../../components/feed/ConfirmSheet';
import { resolveFeedEntries, type FeedEntry } from '../../components/feed/feedResolve';
import { PostCard } from '../../components/feed/PostCard';
import { StoriesRail } from '../../components/feed/StoriesRail';
import { BUFFER_FEED_NATIVE } from '../../lib/bufferFeedNative';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export default function FeedScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const { community, accounts, activeId, setCommunity } = useCommunity();
  const [savedOnly, setSavedOnly] = useState(false);
  const [pendingOff, setPendingOff] = useState<FeedPost | null>(null);

  const savedIds = useMemo(
    () => new Set(community?.savedPostIds ?? []),
    [community?.savedPostIds]
  );

  const entries = useMemo(
    () => (community ? resolveFeedEntries(accounts, community, activeId) : []),
    [accounts, community, activeId]
  );

  // The shelf answers before the page paints — a blank beat, not an empty room.
  if (community === null) {
    return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  }

  const takeOff = (postId: string) => {
    // The tombstone is what makes the removal stick: a reseed re-appends any
    // known-id post it finds missing, so "taken down" is recorded as more
    // than an absence.
    setCommunity(prev => ({
      ...prev,
      posts: prev.posts.filter(p => p.id !== postId),
      removedPostIds: [...(prev.removedPostIds ?? []), postId],
      savedPostIds: (prev.savedPostIds ?? []).filter(id => id !== postId),
    }));
    showToast('Taken off the feed. The look stays in your outfits.', 'info');
  };

  const toggleSave = (postId: string) => {
    const on = savedIds.has(postId);
    setCommunity(prev => {
      const saved = prev.savedPostIds ?? [];
      return {
        ...prev,
        savedPostIds: on ? saved.filter(x => x !== postId) : [...saved, postId],
      };
    });
    showToast(on ? 'Put back with the rest.' : 'Set aside. Only this device keeps the mark.', 'info');
  };

  const mine = entries.filter(e => e.post.authorId === activeId).length;
  const anySaved = entries.some(e => savedIds.has(e.post.id));
  const shown = savedOnly ? entries.filter(e => savedIds.has(e.post.id)) : entries;
  const offName = pendingOff?.look?.name ?? pendingOff?.piece?.name ?? 'this';

  const header = (
    <View>
      <Masthead
        title="Look Book"
        meta={entries.length > 0 ? `${entries.length} shared` : undefined}
      />
      {entries.length > 0 ? (
        <>
          <StoriesRail entries={entries} activeId={activeId} hasGuests={BUFFER_FEED_NATIVE.length > 0} />
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: TYPE.ledgerMeta,
              letterSpacing: TYPE.ledgerSpacing,
              color: tokens.text2,
              marginBottom: 16,
            }}
          >
            Newest first. That is the whole order.
          </Text>
          {/* The one filter the feed has, and it only exists once something
              is set aside to filter to. */}
          {anySaved || savedOnly ? (
            <View style={styles.filterRow}>
              <Chip selected={!savedOnly} onPress={() => setSavedOnly(false)}>
                Everything
              </Chip>
              <Chip selected={savedOnly} onPress={() => setSavedOnly(true)}>
                Set aside
              </Chip>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {savedOnly && shown.length === 0 ? (
        <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={{ fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: tokens.text2 }}>
            Nothing set aside yet. Set aside on a look keeps its place here.
          </Text>
        </View>
      ) : null}
      {entries.length > 0 ? (
        <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: TYPE.label,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: TYPE.labelSpacing,
              color: tokens.text,
              marginBottom: 8,
            }}
          >
            What you are showing
          </Text>
          <Text style={{ fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: tokens.text2 }}>
            {mine === 0
              ? 'None of your looks are on show. Sharing happens one look at a time, from the outfit itself.'
              : `${mine} of your looks ${mine === 1 ? 'is' : 'are'} on show. Each can be taken down from the card it sits on.`}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const empty = (
    <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Text
        style={{
          fontFamily: fonts.displayItalic,
          fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
          fontSize: TYPE.editorial,
          color: tokens.text,
          marginBottom: 8,
        }}
      >
        Nothing is on show yet.
      </Text>
      <Text style={{ fontFamily: fonts.ui, fontSize: TYPE.body, lineHeight: Math.round(TYPE.body * 1.5), color: tokens.text2 }}>
        Looks you choose to share appear here, alongside those from the other wardrobes on this
        device. Sharing is per look, and you can stop at any time.
      </Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <FlatList<FeedEntry>
        data={shown}
        keyExtractor={e => e.post.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <PostCard
              post={item.post}
              author={item.author}
              isMine={item.post.authorId === activeId}
              saved={savedIds.has(item.post.id)}
              onToggleSave={() => toggleSave(item.post.id)}
              onTakeOff={() => setPendingOff(item.post)}
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={savedOnly ? null : empty}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      />

      <ConfirmSheet
        open={pendingOff !== null}
        title="Take it off the feed"
        body={`This takes “${offName}” off the feed for every wardrobe here, and it will not come back on its own. The look itself stays in your outfits.`}
        confirmLabel="Take it off"
        onConfirm={() => {
          if (pendingOff) takeOff(pendingOff.id);
          setPendingOff(null);
        }}
        onClose={() => setPendingOff(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  cardWrap: {
    marginBottom: 24,
  },
  footer: {
    gap: 16,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
  },
});
