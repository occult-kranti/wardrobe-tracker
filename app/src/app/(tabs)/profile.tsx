/**
 * THE HOUSE — the fifth slot, at `/profile` (docs/42 §1, §4).
 *
 * The ADDRESS does not move: the file is `profile.tsx` so a deep link is the
 * same sentence on both apps and in every message anybody ever sent. Only the
 * slot's word and this masthead say House.
 *
 * One hall, doors and facts. THE JUNK-DRAWER LAW: nothing lives on the hall
 * floor — every plate is at most two door rows plus one mono fact line, and a
 * plate that wants a third row becomes a pushed room instead. Every room is
 * ≤2 taps from the bar.
 *
 * DOORS ONLY FOR ROOMS WHOSE PORTS EXIST — the no-plaque rule applied inward.
 * The Ledger, the buying table (Wishlist, Before you buy) and the Shared rail
 * gain their rows as their native screens land, in the floor-plan order of
 * record: nameplate → Ledger → buying table → Shared rail → the Room → the
 * Record → Wardrobes. Until then their FACTS are still stated — the four
 * plates below are the Ledger's own arithmetic, told without a door to a room
 * that is not built. Web `/profile` keeps all its rooms; this hall grows.
 *
 * THE FACTS ARE CUMULATIVE AND NOTHING ELSE (brand law 11): pieces on the
 * rail, wears noted, outfits kept, what it cost. Never a rate, a delta, a
 * streak or a comparison. A plate with nothing to say says nothing — no zeros
 * dressed up as prompts, and the date under the name is a date, never a
 * streak.
 *
 * LOOKS YOU HAVE SHARED is absent, not empty (docs/42 §4). In alpha the Look
 * Book is not in the house, so a heading over an explanation of a room that
 * is not here would be exactly the plaque the ruling forbids.
 *
 * THE SWITCHER. Long-pressing the House slot navigates here carrying a
 * `switcher` param — Instagram's account-switch gesture, translated — and the
 * nameplate's tag-portrait opens the same sheet by tap. The param's VALUE is
 * a nonce rather than a word: holding the slot twice must open the sheet
 * twice, and an unchanged param would be an unchanged render.
 *
 * NOTE FOR THE NEXT WAVE: docs/42 §4 files the sheet as its own
 * `src/components/WardrobeSwitcher.tsx`. That file is not in this squad's
 * declared ownership, so the sheet is written here, whole, ready to be lifted
 * out unchanged when the file is assigned.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatMoney } from '@almari/shared/cost';
import { THEME_LABELS, type Account } from '@almari/shared/types';

import { AccountMark, DisplayChip } from '../../components/feed/bits';
import { Masthead } from '../../components/Masthead';
import { IconSettings } from '../../icons';
import { ACCOUNTS_KEY, storage } from '../../lib/storage';
import { useSession } from '../../lib/session';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { DEFAULT_THEME, RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/** A registry row, as the shelf keeps it. Account-shaped by contract. */
interface WardrobeRow {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  color: string;
  createdAt: string;
  isSample?: boolean;
}

/** 'YYYY-MM-DD' (or an old ISO stamp) → "MARCH 2026". A date, never a streak. */
function keptSince(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  const day = createdAt.slice(0, 10);
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();
}

export default function HouseScreen() {
  const { tokens, resolved } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { switcher } = useLocalSearchParams<{ switcher?: string }>();
  const { activeItems, outfits, syncAccount, wardrobeName, isSample, syncMode } = useWardrobe();
  const { authUser } = useSession();

  const [rows, setRows] = useState<WardrobeRow[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const lastHold = useRef<string | undefined>(undefined);

  // The bar's long press arrives as a changing param; a tap on the tag
  // portrait opens the same sheet directly.
  useEffect(() => {
    if (typeof switcher !== 'string' || switcher === lastHold.current) return;
    lastHold.current = switcher;
    setSwitcherOpen(true);
  }, [switcher]);

  // The wardrobes on this device, read from the same registry the door writes.
  useEffect(() => {
    let live = true;
    storage
      .getItem(ACCOUNTS_KEY)
      .then(raw => {
        if (!live || raw === null) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setRows(parsed as WardrobeRow[]);
      })
      // An unreadable registry means the House says nothing about wardrobes
      // rather than guessing at them.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  /* ---------- the facts, cumulative and about the clothes ---------- */

  const pieces = activeItems.length;
  const wears = useMemo(
    () => activeItems.reduce((sum, i) => sum + i.wearCount, 0),
    [activeItems],
  );
  const spend = useMemo(
    () => activeItems.reduce((sum, i) => sum + (i.cost ?? 0), 0),
    [activeItems],
  );

  const account: Account | null = syncAccount;
  const since = keptSince(account?.createdAt);
  const roomLabel = THEME_LABELS[resolved];
  const others = rows.filter(r => r.id !== account?.id);

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
    color: tokens.text,
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page}>
        {/* The masthead carries the spool — Settings has left the bar and
            this is its one door (docs/42 §6). The masthead's own meta slot is
            left empty so the double rule runs the full width under the title;
            the room states itself on its own plate below, where the floor
            plan already puts it. */}
        <View style={styles.mastheadWrap}>
          <Masthead title="The House" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            testID="house-settings-spool"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.spool, pressed && { opacity: 0.7 }]}
          >
            <IconSettings size={24} color={tokens.text2} />
          </Pressable>
        </View>

        {/* THE NAMEPLATE. The tag-portrait lives here and in the switcher
            sheet — never in the icon row (docs/42 §1). */}
        <View style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <View style={styles.nameplate}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch wardrobes"
              testID="house-tag-portrait"
              onPress={() => setSwitcherOpen(true)}
              style={({ pressed }) => [styles.portrait, pressed && { opacity: 0.7 }]}
            >
              {account ? (
                <AccountMark account={account} size={44} />
              ) : (
                <View style={{ width: 44, height: 55 }} />
              )}
            </Pressable>
            <View style={styles.nameplateText}>
              <Text style={[body, { fontSize: 17 }]} numberOfLines={2}>
                {wardrobeName ?? 'This wardrobe'}
              </Text>
              {since ? (
                <Text style={[ledger, { marginTop: 6 }]}>Kept since {since}</Text>
              ) : null}
              {/* Signed out is a FACT, not a lack — and it is the true one:
                  without an account there is nowhere else this record is. */}
              {authUser === null ? (
                <Text style={[ledger, { marginTop: 4 }]}>Kept on this phone.</Text>
              ) : null}
              {isSample ? (
                <View style={{ marginTop: 8 }}>
                  <DisplayChip>sample wardrobe</DisplayChip>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* THE FOUR FACTUAL PLATES. Cumulative totals about the clothes, and
            a plate with nothing to say says nothing. These are the Ledger's
            own arithmetic, stated here because the Ledger's native port has
            not landed — the fact without the door. */}
        {pieces > 0 || wears > 0 || outfits.length > 0 || spend > 0 ? (
          <View style={styles.stats}>
            {pieces > 0 ? <Stat value={String(pieces)} label="Pieces on the rail" /> : null}
            {wears > 0 ? (
              <Stat value={wears.toLocaleString('en-IN')} label="Wears noted" />
            ) : null}
            {outfits.length > 0 ? (
              <Stat value={String(outfits.length)} label="Outfits kept" />
            ) : null}
            {spend > 0 ? <Stat value={formatMoney(spend)} label="What it cost" /> : null}
          </View>
        ) : null}

        {/* THE LEDGER · THE BUYING TABLE · THE SHARED RAIL slot in here, in
            that order, as their native screens land (docs/42 §4). No row is
            drawn for a room that is not built. */}

        {/* THE ROOM. A fact, not yet a door: the room-change control is web
            work still, and the motif draws once on a change that cannot be
            made here yet. */}
        <SectionTitle>The room</SectionTitle>
        <View style={[styles.row, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={body}>
            {roomLabel}
            {resolved === DEFAULT_THEME ? ' — the default room' : ''}
          </Text>
        </View>

        {/* THE RECORD. Where this wardrobe's record lives, said as a fact,
            with the door to the sheet that holds the account row. */}
        <SectionTitle>The record</SectionTitle>
        {isSample ? (
          <View style={[styles.row, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={body}>A sample never syncs. It belongs to this device.</Text>
          </View>
        ) : (
          <DoorRow
            label={
              syncMode === 'cloud'
                ? 'A copy is kept on your account.'
                : 'This wardrobe stays on this device.'
            }
            onPress={() => router.push('/settings')}
          />
        )}

        {/* WARDROBES ON THIS DEVICE. The other records are named — that is a
            fact this device holds — but opening one is the door's work and
            the door is the only room with a port for it. */}
        <SectionTitle>Wardrobes on this device</SectionTitle>
        {others.map(row => (
          <View
            key={row.id}
            style={[styles.row, styles.wardrobeRow, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          >
            <AccountMark account={row as Account} size={26} />
            <Text style={[body, { flexShrink: 1 }]} numberOfLines={1}>
              {row.name}
            </Text>
          </View>
        ))}
        <DoorRow label="Open another" onPress={() => router.push('/open')} />
      </ScrollView>

      <WardrobeSwitcher
        open={switcherOpen}
        rows={rows}
        activeId={account?.id ?? null}
        onClose={() => setSwitcherOpen(false)}
        onOpenAnother={() => {
          setSwitcherOpen(false);
          router.push('/open');
        }}
      />
    </SafeAreaView>
  );
}

/* ---------- the small cloth this hall is sewn from ---------- */

/** The web's `Stat`, ported: a hero numeral over a ledger label. */
function Stat({ value, label }: { value: string; label: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={styles.stat}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 32,
          lineHeight: 34,
          color: tokens.text,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: TYPE.ledgerMeta,
          letterSpacing: TYPE.ledgerSpacing,
          textTransform: 'uppercase',
          color: tokens.text2,
          marginTop: 8,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: fonts.mono,
        fontSize: TYPE.ledgerMeta,
        letterSpacing: TYPE.ledgerSpacing,
        textTransform: 'uppercase',
        color: tokens.text2,
        marginTop: 24,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * A door. The label carries the house's link treatment — accent ink, quietly
 * underlined — and the whole row is the target, well past the 44dp floor.
 */
function DoorRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        pressed && { backgroundColor: tokens.sunken },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.ui,
          fontSize: TYPE.body,
          color: tokens.accent,
          textDecorationLine: 'underline',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * THE SWITCHER SHEET — grab handle, tag rows, "Open another" (docs/42 §4).
 * It rises like every other sheet in the house: no ceremony, no motif.
 *
 * The rows are FACTS rather than doors, and honestly so: opening a different
 * wardrobe is the door's own work (`/open`), and this build has no native
 * port that switches the open record in place. The moment it lands, each row
 * becomes pressable and nothing else here changes.
 */
function WardrobeSwitcher({
  open,
  rows,
  activeId,
  onClose,
  onOpenAnother,
}: {
  open: boolean;
  rows: WardrobeRow[];
  activeId: string | null;
  onClose: () => void;
  onOpenAnother: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: `${tokens.bgDeep}CC` }]}
        onPress={onClose}
        accessibilityLabel="Close"
      >
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          {/* the grab handle */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[styles.grab, { backgroundColor: tokens.border }]}
          />
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.mono,
              fontSize: TYPE.ledgerMeta,
              letterSpacing: TYPE.ledgerSpacing,
              textTransform: 'uppercase',
              color: tokens.text2,
              marginBottom: 12,
            }}
          >
            Wardrobes on this device
          </Text>
          <ScrollView>
            {rows.map(row => (
              <View key={row.id} style={styles.switcherRow}>
                <AccountMark account={row as Account} size={26} />
                <View style={{ flexShrink: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: fonts.ui, fontSize: TYPE.body, color: tokens.text }}
                  >
                    {row.name}
                  </Text>
                  {row.id === activeId ? (
                    <Text
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: TYPE.ledgerMeta,
                        letterSpacing: TYPE.ledgerSpacing,
                        textTransform: 'uppercase',
                        color: tokens.text2,
                        marginTop: 2,
                      }}
                    >
                      Open now
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
          <DoorRow label="Open another" onPress={onOpenAnother} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  mastheadWrap: {
    paddingTop: 6,
  },
  spool: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
  },
  nameplate: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  portrait: {
    minWidth: 44,
    minHeight: 44,
  },
  nameplateText: {
    flexShrink: 1,
    minWidth: 0,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  stat: {
    width: '50%',
    paddingVertical: 12,
    paddingRight: 12,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 16,
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 12,
    marginBottom: 8,
  },
  wardrobeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scrim: {
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
  grab: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    borderRadius: RADIUS,
    marginBottom: 16,
  },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 8,
  },
});
