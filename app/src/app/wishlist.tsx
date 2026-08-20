/**
 * THE WISHLIST — /wishlist. Ports src/pages/Wishlist.tsx.
 *
 * A DOOR OFF THE HOUSE, not a slot on the bar. The bar holds four rooms this
 * season (docs/42 §1) and a list of things you do not own is not one of them —
 * putting it there would give unbought clothes a permanent place in the
 * furniture of the app, which is the opposite of what the room is for. It is
 * reached from the House, and it carries its own way back, because a pushed
 * route under a header-less stack owes the reader a door out that is not a
 * system gesture (the dressing room's precedent, and the same words).
 *
 * THE COOLING-OFF PHILOSOPHY, CARRIED WHOLE (docs/06 §1 row 7, and the web
 * page's own header). A piece can be put down for a while — seven days by
 * default — and during that wait THE APP SAYS NOTHING: no badge, no count on a
 * door, no notification, no reminder, and nothing on the House door either.
 * The silence is the intervention. The only mark is one quiet mono line on the
 * card itself.
 *
 * When the wait is up, that one card asks ONCE — Keep, Let it go, It came home
 * — three choices of identical weight, none styled as the right answer, and
 * then never asks again. Pieces let go go to a plain ledger headed by one
 * number framed as money that stayed yours. Not money saved from a mistake.
 * Not a score. A total.
 *
 * WHAT THIS ROOM WILL NEVER HOLD, each a standing veto rather than a backlog
 * item: a shop link, an affiliate anything, a price alert, a "do you really
 * need it", a guilt score, a red warning, or a count of what is waiting shown
 * anywhere but on the card. Before You Buy is a savvy friend, never a parent
 * (brand law 11).
 *
 * WHAT DID NOT TRAVEL FROM THE WEB, and why it is an absence rather than an
 * omission. The web card shows up to three owned pieces already close to a
 * wish, from `findSimilarItems` in @almari/shared/similarity. That is real
 * shared maths and could be called here — but it wants photographs of the
 * closet in a list that is already dense on a phone, and the web's own answer
 * to "hold it up against the closet" is a second page this app does not have
 * yet. Building half of it — matches with no way through to the comparison —
 * would be the worse half. Named here so the next squad inherits the decision
 * rather than the silence.
 */
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney, formatPrice } from '@almari/shared/cost';
import { addDays, todayLocal } from '@almari/shared/dates';
import { categoryLabel, type WishlistItem } from '@almari/shared/types';

import { Button } from '../components/Button';
import { Masthead } from '../components/Masthead';
import { showToast } from '../components/Toast';
import { ConfirmSheet } from '../components/feed/ConfirmSheet';
import { Basting } from '../components/furniture/Basting';
import { DOOR, HOUSE } from '../components/wishlist/addresses';
import { useWishlist, type WishPatch } from '../components/wishlist/contract';
import {
  addedLine,
  onTheListLine,
  openTotal,
  sections,
  shortDay,
  stayedYoursLine,
} from '../components/wishlist/list';
import { WishCard, type WishActions } from '../components/wishlist/WishCard';
import { WishSheet, type WishForm } from '../components/wishlist/WishSheet';
import { IconPlus } from '../icons';
import { useWardrobe } from '../lib/wardrobe';
import { useFamilies } from '../tokens/FontsContext';
import { RADIUS } from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

/** What the sheet is doing, and to what. Closed is the absence of a subject. */
type Editing = { mode: 'add' } | { mode: 'amend'; id: string } | null;

export default function WishlistScreen() {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { status, settings } = useWardrobe();
  // The list and its four mutators come through the room's own contract mirror
  // (components/wishlist/contract.ts), which is where any drift between this
  // room and the provider is caught by the compiler rather than by a tester.
  const { wishlist, wired, addWish, updateWish, removeWish, promoteWish } = useWishlist();

  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<WishlistItem | null>(null);

  const parts = useMemo(() => sections(wishlist), [wishlist]);
  const amending =
    editing?.mode === 'amend' ? wishlist.find(w => w.id === editing.id) : undefined;

  const gutter = 20;
  const cardWidth = width - gutter * 2;

  const editorial = {
    fontFamily: fonts.displayItalic,
    fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? ('normal' as const) : ('italic' as const),
    fontSize: TYPE.editorial,
    lineHeight: Math.round(TYPE.editorial * 1.3),
    color: tokens.text,
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
  const sectionLabel = {
    fontFamily: fonts.ui,
    fontSize: TYPE.label,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: TYPE.labelSpacing,
    color: tokens.text,
    marginBottom: 12,
  };

  /* ---------- the four verbs ---------- */

  /**
   * The answer stamp. A card asks once and only once, so every answer that
   * leaves a wish ON the list carries `asked: true` back into the record.
   *
   * The key is written only when there IS a wait — never `coolingOff:
   * undefined`, which a spread would turn into an own property holding
   * nothing. A wish that never waited must stay byte-identical to one written
   * by the browser.
   */
  const answered = (item: WishlistItem, patch: WishPatch): WishPatch =>
    item.coolingOff ? { ...patch, coolingOff: { ...item.coolingOff, asked: true } } : patch;

  const commit = (form: WishForm, waitDays: number) => {
    if (editing?.mode === 'amend') {
      // NULL, NOT UNDEFINED, for the three fields a wish may be without.
      // Lead ruling R4: the record reads `undefined` as "the form said nothing
      // about this" and `null` as "take it off". A brand typed by mistake is
      // cleared by emptying the box, which is the only gesture anybody will
      // look for — sending `undefined` would leave the mistake on the record
      // and the form would appear to have done nothing.
      updateWish(editing.id, {
        name: form.name,
        category: form.category,
        color: form.color,
        priority: form.priority,
        brand: form.brand ?? null,
        price: form.price ?? null,
        notes: form.notes ?? null,
      });
      showToast(`Amended. “${form.name}”.`, 'success');
      return;
    }
    addWish({
      ...form,
      status: 'waiting',
      // Silence for the whole wait, then one question. Nothing in between.
      ...(waitDays > 0
        ? { coolingOff: { endsAt: addDaysFromToday(waitDays), asked: false } }
        : {}),
    });
    showToast(addedLine(waitDays), 'success');
  };

  const actionsFor = (item: WishlistItem): WishActions => ({
    onKeep: () => {
      updateWish(item.id, answered(item, { status: 'kept' }));
      showToast('Kept. It stays on the list.', 'info');
    },
    onRelease: () => {
      updateWish(item.id, answered(item, { status: 'let-go', releasedAt: todayLocal() }));
      showToast('Let it go. It goes to the ledger.', 'info');
    },
    onPromote: () => {
      const pieceId = promoteWish(item.id);
      // An explicit null means the record found no such wish, and a toast
      // claiming a piece came home when none did is worse than silence. Any
      // other answer — an id, or a provider that returns nothing — is the
      // promote having happened.
      if (pieceId === null) return;
      // Say what happened to the RECORD, not just to the list: there is a
      // piece in the closet now that was not there before, and a person who
      // does not know that will go looking for it here.
      showToast(`Came home. “${item.name}” is a piece in the closet now, at 0 wears.`, 'success');
    },
    onAmend: () => setEditing({ mode: 'amend', id: item.id }),
    onRemove: () => setRemoving(item),
  });

  const confirmRemove = () => {
    const item = removing;
    setRemoving(null);
    if (!item) return;
    // The put-it-back closure, if this provider hands one back. The confirm's
    // copy never promised it, so a provider that returns nothing breaks no
    // sentence — the dressing room's rule, kept.
    const putBack = removeWish(item.id);
    showToast(
      'Off the list.',
      'info',
      typeof putBack === 'function' ? { label: 'Undo', run: putBack } : undefined,
    );
  };

  /* ---------- the door ---------- */

  // Lead ruling R7: a room off the bar, cold-opened with no wardrobe, goes to
  // the door rather than rendering an empty list of somebody else's wishes.
  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: tokens.bg }} />;
  if (status === 'none') return <Redirect href={DOOR} />;

  const renderList = (list: WishlistItem[]) => (
    <View style={styles.list}>
      {list.map(item => (
        <WishCard
          key={item.id}
          item={item}
          categoryName={categoryLabel(settings, item.category)}
          width={cardWidth}
          actions={actionsFor(item)}
        />
      ))}
    </View>
  );

  const openSum = openTotal(parts.open);

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* THE WAY BACK. Without it the only exit from a room off the bar is a
            system gesture, which a tester on a borrowed phone will not find. */}
        <View style={styles.leave}>
          <Button
            tone="tertiary"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace(HOUSE);
            }}
          >
            Back to the house
          </Button>
        </View>

        <Masthead title="Wishlist" meta={onTheListLine(parts.open) ?? undefined} />

        {/* Squad A2's wishlist surface has not landed in this build. The room
            still stands and still opens; it simply has nothing to hold, and
            says so rather than offering a control that would do nothing. */}
        {!wired ? (
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={editorial}>The list is not connected to this wardrobe yet.</Text>
            <Text style={[body, { marginTop: 8 }]}>
              Nothing is missing from the record — anything already noted travels in the export and
              opens in the browser exactly as it was.
            </Text>
          </View>
        ) : wishlist.length === 0 ? (
          <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={[editorial, { marginBottom: 8 }]}>Nothing on the list.</Text>
            <Text style={[body, { marginBottom: 16 }]}>
              Pieces you are thinking about wait here. Give one a few days of silence and see whether
              it is still on your mind at the end.
            </Text>
            {/* The one primary on this view (brand law 3). */}
            <Button
              tone="primary"
              icon={<IconPlus size={16} color={tokens.onInk} />}
              onPress={() => setEditing({ mode: 'add' })}
            >
              Add something you are considering
            </Button>
          </View>
        ) : (
          <>
            {parts.waiting.length > 0 ? (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={sectionLabel}>
                  Waiting
                </Text>
                {renderList(parts.waiting)}
              </View>
            ) : null}

            {parts.kept.length > 0 ? (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={sectionLabel}>
                  Kept
                </Text>
                {renderList(parts.kept)}
              </View>
            ) : null}

            {/* THE LEDGER OF WHAT STAYED. One number, framed as money that
                stayed yours — never money saved from a mistake, never a score. */}
            {parts.released.length > 0 ? (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={sectionLabel}>
                  Stayed yours
                </Text>
                <View
                  style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                >
                  <Text style={editorial}>{stayedYoursLine(parts.released)}</Text>
                  <Basting width={cardWidth - 40} style={{ marginVertical: 16 }} />
                  {parts.released.map(item => (
                    <View key={item.id} style={styles.releasedRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{ fontFamily: fonts.ui, fontSize: 14, color: tokens.text }}
                        >
                          {item.name}
                        </Text>
                        <Text style={[ledger, { marginTop: 4 }]}>
                          {[item.brand, item.releasedAt ? `let go ${shortDay(item.releasedAt)}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <Text style={[ledger, { fontSize: 12 }]}>
                        {item.price !== undefined ? formatPrice(item.price) : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* WHERE "IT CAME HOME" LANDS. The landed promoteWish writes the
                piece into the closet and leaves the wish here marked 'bought'
                — the browser prints its own Bought section from exactly these
                rows, and one document serves both apps. */}
            {parts.bought.length > 0 ? (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={sectionLabel}>
                  Bought
                </Text>
                {renderList(parts.bought)}
              </View>
            ) : null}

            <View style={styles.add}>
              <Button
                tone="secondary"
                icon={<IconPlus size={16} color={tokens.text} />}
                onPress={() => setEditing({ mode: 'add' })}
              >
                Add something you are considering
              </Button>
            </View>

            {/* THE TOTAL, STATED ONCE. */}
            {parts.open.length > 0 ? (
              <View
                style={[
                  styles.plate,
                  { backgroundColor: tokens.sunken, borderColor: tokens.border, marginTop: 24 },
                ]}
              >
                {/* No prices on file means no sum to state — an amount of zero
                    would assert one. */}
                {openSum > 0 ? (
                  <>
                    <Text
                      style={{
                        fontFamily: fonts.display,
                        fontSize: 28,
                        color: tokens.text,
                      }}
                    >
                      {formatMoney(openSum)}
                    </Text>
                    <Text style={[ledger, { marginTop: 4 }]}>Still on the list</Text>
                  </>
                ) : (
                  <Text style={ledger}>No prices noted</Text>
                )}
                <Text style={[ledger, { marginTop: 12 }]}>
                  {parts.open.length} {parts.open.length === 1 ? 'piece' : 'pieces'}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <WishSheet
        open={editing !== null}
        mode={editing?.mode === 'amend' ? 'amend' : 'add'}
        initial={
          amending
            ? {
                name: amending.name,
                brand: amending.brand,
                category: amending.category,
                color: amending.color,
                price: amending.price,
                priority: amending.priority,
                notes: amending.notes,
              }
            : undefined
        }
        existing={amending}
        categories={settings.categories}
        onClose={() => setEditing(null)}
        onCommit={commit}
      />

      <ConfirmSheet
        open={removing !== null}
        title="Take it off the list"
        body={
          removing
            ? `“${removing.name}” comes off the list and out of the ledger. Nothing in the closet changes — a wish was never a piece.`
            : ''
        }
        confirmLabel="Take it off"
        onConfirm={confirmRemove}
        onClose={() => setRemoving(null)}
      />
    </SafeAreaView>
  );
}

/**
 * The end of a wait, in the record's own words.
 *
 * `addDays` is @almari/shared/dates — the only source of day arithmetic in
 * this app (docs/34 §5). It is wrapped here for one reason: the caller has a
 * count of days and no start date, and spelling `addDays(todayLocal(), n)` at
 * the call site is where somebody eventually writes `new Date()` instead.
 */
function addDaysFromToday(days: number): string {
  return addDays(todayLocal(), days);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  leave: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
    alignItems: 'flex-start',
  },
  section: {
    marginBottom: 28,
  },
  list: {
    gap: 16,
  },
  releasedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    width: '100%',
  },
  add: {
    marginTop: 4,
    alignItems: 'flex-start',
  },
});
