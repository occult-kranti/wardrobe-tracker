/**
 * A conversation — ports src/pages/Chats.tsx ChatThread.
 *
 * MEMBERSHIP, CHECKED IN ONE PLACE, the web's own law: a thread you are not
 * in must read the same as a thread that is gone — same copy, same plate,
 * no compose box.
 *
 * The verbs that live in a thread (toile-social): a message may CARRY a
 * look or a piece (Attach — a snapshot, nothing moves) and may BE a request
 * (Ask after it — status `asked`, owner named). Lending stays with the
 * owner; the app's wardrobe provider does not carry loans yet, so a
 * request's status reads as a fact here and the owner's advance buttons
 * arrive with the provider's loan wave (seam recorded in MessageRow).
 *
 * NOBODY ANSWERS BY MACHINE: on the web the sample wardrobes speak only in
 * their seeded threads — no relay call, no generated replies. The same
 * quiet holds here; a message you send is simply kept.
 *
 * ARRIVALS: `attach` / `ask` params in the web's own shapes (store.ts)
 * pre-load the composer or the ask sheet, once per landing.
 */
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState, useEffect } from 'react';
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

import { todayLocal } from '@almari/shared/dates';
import type { ChatMessage, SharedLook, SharedPiece } from '@almari/shared/types';

import { LookLine, PieceLine } from '../../components/chats/AttachmentLines';
import { nowLocalStamp, oldestFirst } from '../../components/chats/format';
import { MessageRow } from '../../components/chats/MessageRow';
import {
  firstParam,
  newLocalId,
  parseAsk,
  parseAttach,
  useChatsStore,
} from '../../components/chats/store';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Masthead } from '../../components/Masthead';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/** How many closet pieces the send-a-piece list shows before it says so. */
const PIECE_PICKER_LIMIT = 60;

export default function ChatThreadScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; attach?: string; ask?: string }>();
  const id = firstParam(params.id);
  const store = useChatsStore();
  const { ready, activeId, accounts, community } = store;
  const { outfits, activeItems, getItem } = useWardrobe();

  const [draft, setDraft] = useState('');
  const [attached, setAttached] = useState<{ look?: SharedLook; piece?: SharedPiece }>({});
  const [attaching, setAttaching] = useState<null | 'look' | 'piece'>(null);
  const [asking, setAsking] = useState(false);
  const [askPiece, setAskPiece] = useState('');
  const [askOwner, setAskOwner] = useState('');
  const [askNote, setAskNote] = useState('');

  const byId = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const found = community.conversations.find(c => c.id === id);
  // Membership, checked in one place — the web's own guard.
  const conversation =
    found && activeId && found.memberIds.includes(activeId) ? found : undefined;

  const messages = useMemo(
    () => community.messages.filter(m => m.conversationId === id).sort(oldestFirst),
    [community.messages, id],
  );

  // An arrival is consumed once per landing — not re-applied on every
  // storage refresh, and never applied to a thread that refused entry.
  const consumed = useRef(false);
  const arrivedAttach = parseAttach(firstParam(params.attach));
  const arrivedAsk = parseAsk(firstParam(params.ask));
  useEffect(() => {
    if (consumed.current || !ready || !conversation) return;
    consumed.current = true;
    if (arrivedAttach) setAttached(arrivedAttach);
    if (arrivedAsk) {
      setAskPiece(arrivedAsk.pieceName);
      // A request is answered by its owner's wardrobe; an owner who is not
      // in this thread cannot be preselected — the sheet opens with the
      // piece named and the owner left to choose.
      setAskOwner(
        conversation.memberIds.includes(arrivedAsk.ownerId) ? arrivedAsk.ownerId : '',
      );
      setAsking(true);
    }
  }, [ready, conversation, arrivedAttach, arrivedAsk]);

  const backToConversations = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/chats' as Href);
  };

  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };
  const body = {
    fontFamily: fonts.ui,
    fontSize: TYPE.body,
    lineHeight: Math.round(TYPE.body * 1.5),
    color: tokens.text2,
  };

  if (!ready) {
    return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]} />;
  }

  if (!conversation || !activeId) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <View style={styles.page}>
          <Masthead title="Conversations" />
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
              No record of this thread.
            </Text>
            <Text style={[body, { marginBottom: 16 }]}>
              It may have been removed, or it never existed on this device.
            </Text>
            <Button tone="primary" onPress={backToConversations}>
              Back to conversations
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const withYou = conversation.memberIds.filter(m => m !== activeId).map(m => byId.get(m));
  const present = withYou.filter((a): a is NonNullable<typeof a> => Boolean(a));
  const title = conversation.isGroup
    ? conversation.name ?? 'The group'
    : withYou[0]?.name ?? 'Someone';

  const send = async () => {
    if (!draft.trim() && !attached.look && !attached.piece) return;
    const message: ChatMessage = {
      id: newLocalId(),
      conversationId: conversation.id,
      authorId: activeId,
      date: todayLocal(),
      at: nowLocalStamp(),
      text: draft.trim(),
      look: attached.look,
      piece: attached.piece,
    };
    await store.appendMessage(message);
    setDraft('');
    setAttached({});
  };

  /**
   * A request is always between two wardrobes — the asker and the owner —
   * even when written in a group, which is why the owner is named. A
   * question to the room is just a message.
   */
  const sendAsk = async () => {
    if (!askPiece.trim() || !askOwner) return;
    const owner = byId.get(askOwner);
    await store.appendMessage({
      id: newLocalId(),
      conversationId: conversation.id,
      authorId: activeId,
      date: todayLocal(),
      at: nowLocalStamp(),
      text: askNote.trim() || `Asking after the ${askPiece.trim()}${owner ? `, ${owner.name}` : ''}.`,
      request: { pieceName: askPiece.trim(), status: 'asked', ownerId: askOwner },
    });
    setAsking(false);
    setAskPiece('');
    setAskNote('');
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ alignItems: 'flex-start', marginBottom: 8 }}>
          {/* The way out sits at the top, not forty messages down. */}
          <Button tone="tertiary" onPress={backToConversations}>
            Conversations
          </Button>
        </View>
        <Masthead
          title={title}
          meta={
            conversation.isGroup
              ? `${conversation.memberIds.length} wardrobes`
              : withYou[0]?.handle
          }
        />
        {conversation.about ? (
          <Text
            style={{
              fontFamily: fonts.displayItalic,
              fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
              fontSize: 19,
              lineHeight: 25,
              color: tokens.text,
              marginTop: -12,
              marginBottom: 16,
            }}
          >
            {conversation.about}
          </Text>
        ) : null}

        <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border, alignItems: 'stretch' }]}>
          <View style={{ gap: 20 }}>
            {messages.map(message => (
              <MessageRow key={message.id} message={message} author={byId.get(message.authorId)} />
            ))}
            {messages.length === 0 ? (
              <Text style={body}>Nothing said yet. The first line starts the record.</Text>
            ) : null}
          </View>

          {/* the basting line between the record and the composer */}
          <View style={[styles.basting, { borderColor: tokens.border }]} />

          {attached.look ? (
            <View style={{ marginBottom: 12, alignItems: 'flex-start', gap: 4 }}>
              <LookLine look={attached.look} />
              <Button tone="tertiary" onPress={() => setAttached({})}>
                Take it off
              </Button>
            </View>
          ) : null}
          {attached.piece ? (
            <View style={{ marginBottom: 12, alignItems: 'flex-start', gap: 4 }}>
              <PieceLine piece={attached.piece} />
              <Button tone="tertiary" onPress={() => setAttached({})}>
                Take it off
              </Button>
            </View>
          ) : null}

          <TextInput
            accessibilityLabel="Write a message"
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask after a piece, or send a look"
            placeholderTextColor={tokens.text2}
            style={[
              styles.input,
              { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
            ]}
          />
          <View style={styles.composerRow}>
            {/* Hidden when nobody in the thread is still on the device. */}
            {present.length > 0 ? (
              <Button
                compact
                onPress={() => {
                  setAskOwner(present[0]?.id ?? '');
                  setAsking(true);
                }}
              >
                Ask after a piece
              </Button>
            ) : null}
            <Button compact onPress={() => setAttaching('look')}>
              Attach a look
            </Button>
            <Button compact onPress={() => setAttaching('piece')}>
              Attach a piece
            </Button>
          </View>
          <View style={{ alignItems: 'flex-start', marginTop: 12 }}>
            <Button
              tone="primary"
              disabled={!draft.trim() && !attached.look && !attached.piece}
              onPress={send}
            >
              Send
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* Ask after a piece */}
      <Modal visible={asking} transparent animationType="slide" onRequestClose={() => setAsking(false)}>
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => setAsking(false)} />
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
                Ask after a piece
              </Text>
              <Text style={[body, { fontSize: 13, marginBottom: 12 }]}>
                A request goes to one person, so their wardrobe is the one that can answer it. To
                ask the room in general, just write a message.
              </Text>

              <Text style={[ledger, { marginBottom: 8 }]}>Whose piece</Text>
              <View style={styles.chipRow}>
                {present.map(a => (
                  <Chip key={a.id} selected={askOwner === a.id} onPress={() => setAskOwner(a.id)}>
                    {a.name}
                  </Chip>
                ))}
              </View>

              <Text style={[ledger, { marginTop: 16, marginBottom: 8 }]}>Which piece</Text>
              <TextInput
                accessibilityLabel="Which piece"
                value={askPiece}
                onChangeText={setAskPiece}
                placeholder="The ivory bandhgala"
                placeholderTextColor={tokens.text2}
                style={[
                  styles.input,
                  { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
                ]}
              />
              <Text style={[ledger, { textTransform: 'none', marginTop: 6 }]}>
                As they would call it.
              </Text>

              <Text style={[ledger, { marginTop: 16, marginBottom: 8 }]}>A line with it</Text>
              <TextInput
                accessibilityLabel="A line with it"
                value={askNote}
                onChangeText={setAskNote}
                placeholder="Wedding on the 30th, home by the 2nd"
                placeholderTextColor={tokens.text2}
                style={[
                  styles.input,
                  { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
                ]}
              />
              <Text style={[ledger, { textTransform: 'none', marginTop: 6 }]}>
                Optional. What it is for, and when it comes back.
              </Text>

              <View style={styles.sheetFooter}>
                <Button tone="tertiary" onPress={() => setAsking(false)}>
                  Not now
                </Button>
                <Button tone="primary" disabled={!askPiece.trim() || !askOwner} onPress={sendAsk}>
                  Ask
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Send a look */}
      <Modal
        visible={attaching === 'look'}
        transparent
        animationType="slide"
        onRequestClose={() => setAttaching(null)}
      >
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => setAttaching(null)} />
          <View style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <ScrollView>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: TYPE.editorial,
                  color: tokens.text,
                  marginBottom: 12,
                }}
              >
                Send a look
              </Text>
              {outfits.length === 0 ? (
                <Text style={[body, { fontSize: 14 }]}>
                  No looks saved yet. Put one together in Outfits and it will be here to send.
                </Text>
              ) : null}
              <View style={{ gap: 8 }}>
                {outfits.map(outfit => (
                  <Pressable
                    key={outfit.id}
                    accessibilityRole="button"
                    accessibilityLabel={outfit.name}
                    onPress={() => {
                      // The snapshot is taken NOW — names resolved at send
                      // time, exactly as the web's picker does it.
                      setAttached({
                        look: {
                          outfitId: outfit.id,
                          name: outfit.name,
                          imageUrl: outfit.imageUrl,
                          occasion: outfit.occasion,
                          pieces: outfit.itemIds
                            .map(i => getItem(i)?.name)
                            .filter((n): n is string => Boolean(n)),
                        },
                      });
                      setAttaching(null);
                    }}
                    style={({ pressed }) => [
                      styles.pickRow,
                      { borderColor: tokens.border },
                      pressed && { backgroundColor: tokens.sunken },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text }}
                      >
                        {outfit.name}
                      </Text>
                      {outfit.occasion ? (
                        <Text style={[ledger, { textTransform: 'none', marginTop: 2 }]}>
                          {outfit.occasion}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Send a piece */}
      <Modal
        visible={attaching === 'piece'}
        transparent
        animationType="slide"
        onRequestClose={() => setAttaching(null)}
      >
        <View style={styles.backdrop}>
          <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={() => setAttaching(null)} />
          <View style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <ScrollView>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: TYPE.editorial,
                  color: tokens.text,
                  marginBottom: 12,
                }}
              >
                Send a piece
              </Text>
              {activeItems.length === 0 ? (
                <Text style={[body, { fontSize: 14 }]}>
                  The closet is empty. Add a piece and it will be here to send.
                </Text>
              ) : null}
              <View style={{ gap: 8 }}>
                {activeItems.slice(0, PIECE_PICKER_LIMIT).map(item => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    onPress={() => {
                      setAttached({
                        piece: {
                          itemId: item.id,
                          name: item.name,
                          imageUrl: item.imageUrl,
                          category: item.category,
                          color: item.color,
                        },
                      });
                      setAttaching(null);
                    }}
                    style={({ pressed }) => [
                      styles.pickRow,
                      { borderColor: tokens.border },
                      pressed && { backgroundColor: tokens.sunken },
                    ]}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 35,
                        borderRadius: RADIUS,
                        backgroundColor: item.color,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: tokens.border,
                      }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text, flex: 1 }}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {activeItems.length > PIECE_PICKER_LIMIT ? (
                <Text style={[ledger, { textTransform: 'none', marginTop: 12 }]}>
                  Showing {PIECE_PICKER_LIMIT} of {activeItems.length}. Search the closet for the
                  rest.
                </Text>
              ) : null}
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
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
    alignItems: 'flex-start',
  },
  basting: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    marginVertical: 16,
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  composerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
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
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
});
