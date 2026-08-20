/**
 * Conversations — ports src/pages/Chats.tsx (the list half; the thread
 * itself lives at /chats/[id]).
 *
 * The four verbs live here in their chat forms (toile-social): Attach shows
 * a snapshot into one message, Ask is a request on a message, and nothing
 * ever grows a count — no unread badges, no message totals, reverse-chron
 * and that is the whole algorithm.
 *
 * Membership is the one lock, checked exactly as the web checks it: the
 * list shows only threads the open wardrobe is IN. The sample wardrobes'
 * own threads live on this device once installed, but a thread you are not
 * in reads the same as a thread that is gone.
 *
 * ARRIVALS: the feed's "Attach" / "Ask after it" land here carrying the
 * web's own shapes (social.tsx PostCard), JSON-encoded in the `attach` /
 * `ask` params — see store.ts. The snapshot is shown riding along; picking
 * a thread carries it through to the composer.
 */
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LookLine, PieceLine } from '../../components/chats/AttachmentLines';
import { newestFirst, shortDate } from '../../components/chats/format';
import { TagMark } from '../../components/chats/TagMark';
import { ThreadRow } from '../../components/chats/ThreadRow';
import {
  firstParam,
  parseAsk,
  parseAttach,
  useChatsStore,
  type ChatAccount,
} from '../../components/chats/store';
import { Button } from '../../components/Button';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

export default function ChatsScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const params = useLocalSearchParams<{ attach?: string; ask?: string }>();
  const store = useChatsStore();
  const { ready, activeId, accounts, community } = store;

  const [starting, setStarting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const attachRaw = firstParam(params.attach);
  const askRaw = firstParam(params.ask);
  const attach = parseAttach(attachRaw);
  const ask = parseAsk(askRaw);

  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const others = accounts.filter(a => a.id !== activeId);

  /** The web's own resolution: threads the open wardrobe is in, newest first. */
  const threads = useMemo(() => {
    return community.conversations
      .filter(c => c.memberIds.includes(activeId ?? ''))
      .map(c => {
        const messages = community.messages
          .filter(m => m.conversationId === c.id)
          .sort(newestFirst);
        return { conversation: c, last: messages[0] };
      })
      .sort((a, b) =>
        (b.last?.at ?? b.last?.date ?? '').localeCompare(a.last?.at ?? a.last?.date ?? ''),
      );
  }, [community, activeId]);

  /** Carry an arrival through to a thread's own page. */
  const openThread = (id: string) => {
    router.push({
      pathname: '/chats/[id]',
      params: {
        id,
        ...(attachRaw ? { attach: attachRaw } : {}),
        ...(askRaw ? { ask: askRaw } : {}),
      },
    } as Href);
  };

  const startConversation = async () => {
    if (!activeId || picked.length === 0) return;
    const id = await store.startConversation([activeId, ...picked], groupName);
    setStarting(false);
    setPicked([]);
    setGroupName('');
    openThread(id);
  };

  // The shelf answers before the room paints — a blank beat, not a flash
  // of an empty list that is not empty.
  if (!ready) {
    return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]} />;
  }

  const editorial = {
    fontFamily: fonts.displayItalic,
    fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? ('normal' as const) : ('italic' as const),
    fontSize: TYPE.editorial,
    color: tokens.text,
    marginBottom: 8,
  };
  const body = {
    fontFamily: fonts.ui,
    fontSize: TYPE.body,
    lineHeight: Math.round(TYPE.body * 1.5),
    color: tokens.text2,
  };
  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* The masthead, hand-set so the meta stays the web's own line. */}
        <View style={styles.masthead}>
          <View style={[styles.mastheadRow, { borderBottomColor: tokens.text }]}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.display,
                fontSize: TYPE.masthead,
                lineHeight: Math.round(TYPE.masthead * 1.1),
                letterSpacing: -0.01 * TYPE.masthead,
                color: tokens.text,
              }}
            >
              Conversations
            </Text>
            {threads.length > 0 ? (
              <Text style={[ledger, { paddingBottom: 4 }]}>{threads.length} open</Text>
            ) : null}
          </View>
          <View style={[styles.thinRule, { backgroundColor: tokens.text }]} />
        </View>

        {/* An arrival riding along, waiting for its thread. */}
        {attach || ask ? (
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border, marginBottom: 16 }]}>
            <Text style={[ledger, { marginBottom: 8 }]}>Riding along</Text>
            {attach?.look ? <LookLine look={attach.look} /> : null}
            {attach?.piece ? <PieceLine piece={attach.piece} /> : null}
            {ask ? (
              <Text style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text }}>
                Asking after the {ask.pieceName}
                {byId.get(ask.ownerId) ? `, ${byId.get(ask.ownerId)!.name}` : ''}
              </Text>
            ) : null}
            <Text style={[body, { marginTop: 8 }]}>Choose a thread to carry it.</Text>
            <View style={{ marginTop: 8 }}>
              <Button
                tone="tertiary"
                // An empty param parses to no arrival; undefined is not a
                // value setParams can carry.
                onPress={() => router.setParams({ attach: '', ask: '' })}
              >
                Not now
              </Button>
            </View>
          </View>
        ) : null}

        {threads.length === 0 ? (
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={editorial}>No conversations yet.</Text>
            <Text style={[body, { marginBottom: 16 }]}>
              Threads between the wardrobes on this device: ask after a piece, send a look, say
              when something came home. None of it leaves.
            </Text>
            {others.length > 0 ? (
              <Button tone="primary" onPress={() => setStarting(true)}>
                Start one
              </Button>
            ) : (
              // Alone on the device there is no one to write to. The web
              // offers the sample wardrobes at its door; the same offer
              // stands here, threads and all.
              <Button tone="primary" onPress={() => store.installSampleThreads()}>
                Add the sample wardrobes
              </Button>
            )}
          </View>
        ) : (
          <>
            <View style={styles.listHeader}>
              <Text style={ledger}>Threads · most recent first</Text>
              {others.length > 0 ? (
                <Button tone="primary" compact onPress={() => setStarting(true)}>
                  New
                </Button>
              ) : null}
            </View>
            <View style={{ gap: 8 }}>
              {threads.map(({ conversation, last }) => {
                const rest = conversation.memberIds
                  .filter(id => id !== activeId)
                  .map(id => byId.get(id))
                  .filter((a): a is ChatAccount => Boolean(a));
                const title = conversation.isGroup
                  ? conversation.name ?? 'The group'
                  : rest[0]?.name ?? 'Someone';
                const lastLine = last
                  ? `${byId.get(last.authorId)?.handle ?? ''} · ${last.text}`
                  : 'No messages yet';
                return (
                  <ThreadRow
                    key={conversation.id}
                    title={title}
                    lastLine={lastLine}
                    date={last ? shortDate(last.date) : ''}
                    others={rest}
                    onPress={() => openThread(conversation.id)}
                  />
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* New conversation — one wardrobe for a direct thread, several for a group. */}
      <Modal
        visible={starting}
        transparent
        animationType="slide"
        onRequestClose={() => setStarting(false)}
      >
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => setStarting(false)} />
          <View style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: TYPE.editorial,
                  color: tokens.text,
                  marginBottom: 8,
                }}
              >
                New conversation
              </Text>
              <Text style={[body, { fontSize: 13, marginBottom: 12 }]}>
                Pick one wardrobe for a direct thread, or several for a group.
              </Text>
              {others.map(account => {
                const on = picked.includes(account.id);
                return (
                  <Pressable
                    key={account.id}
                    accessibilityRole="button"
                    accessibilityLabel={account.name}
                    accessibilityState={{ selected: on }}
                    onPress={() =>
                      setPicked(p => (on ? p.filter(x => x !== account.id) : [...p, account.id]))
                    }
                    style={[
                      styles.pickRow,
                      {
                        borderColor: on ? tokens.text : 'transparent',
                        backgroundColor: on ? tokens.sunken : 'transparent',
                      },
                    ]}
                  >
                    <TagMark monogram={account.monogram} color={account.color} size={26} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text }}
                      >
                        {account.name}
                      </Text>
                      <Text style={[ledger, { textTransform: 'none', marginTop: 2 }]}>
                        {account.handle}
                      </Text>
                    </View>
                    {on ? <Text style={[ledger, { textTransform: 'none' }]}>in</Text> : null}
                  </Pressable>
                );
              })}
              {picked.length > 1 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[ledger, { marginBottom: 8 }]}>Name this group</Text>
                  <TextInput
                    accessibilityLabel="Name this group"
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholder="The Rail"
                    placeholderTextColor={tokens.text2}
                    style={[
                      styles.input,
                      { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
                    ]}
                  />
                  <Text style={[ledger, { textTransform: 'none', marginTop: 6 }]}>
                    Optional. Their names are used otherwise.
                  </Text>
                </View>
              ) : null}
              <View style={styles.sheetFooter}>
                <Button tone="tertiary" onPress={() => setStarting(false)}>
                  Not now
                </Button>
                <Button tone="primary" disabled={picked.length === 0} onPress={startConversation}>
                  {picked.length > 1 ? 'Start the group' : 'Start it'}
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  masthead: {
    marginBottom: 24,
  },
  mastheadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
  },
  thinRule: {
    marginTop: 3,
    height: 1,
    opacity: 0.55,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
    alignItems: 'flex-start',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  sheetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
});
