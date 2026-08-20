/**
 * Settings — the account, the per-wardrobe sync choice, the room this screen
 * is shown in, and the door the record leaves and returns through. Ported from
 * the web's Settings account section, its "Appearance" card, its "Your data"
 * card, and SwitchWardrobe's "Where the record lives" (docs/34 §2.2). Storage
 * is still to come; the screen says so rather than pretending the list is
 * finished.
 *
 * THE ROOM ARRIVES HERE, not on the House. The House states which room is on
 * (profile.tsx reads THEME_LABELS[resolved] and always has); this screen is
 * where it is chosen, because a choice that repaints the whole interface
 * belongs beside the other house choices and not in a hall the reader is
 * passing through. The choice is the SCREEN's, never the wardrobe's, and it is
 * written under the web's own key in the web's own shape — see
 * tokens/ThemeContext.tsx for the convention and why it is not two.
 *
 * SETTINGS HAS LEFT THE BAR (docs/42 §6). It moved from `(tabs)/settings.tsx`
 * to this pushed route outside the tabs so the fifth slot could be the House;
 * `/settings` survives verbatim, every setting with it, and the House's
 * masthead spool is the door. Nothing about the screen below changed in the
 * move except the depth of its imports and the way back added here — a
 * pushed route under a header-less stack owes the reader a door out that is
 * not a system gesture.
 *
 * The laws this screen carries:
 *   - sync is OPT-IN per wardrobe, off by default; a sample never gets the
 *     choice at all (a worked example belongs to the device);
 *   - the plain trust sentence ships wherever sync is offered (docs/35:
 *     until E2E encryption lands, the copy says who can read a synced copy);
 *   - signing out deletes nothing, and the copy says so where the button is;
 *   - the record leaves whole and returns whole. What a backup IS lives in
 *     lib/exportClient (the web's allowlist, mirrored); this screen does only
 *     the phone's half — the press, the counts, the confirm, the sentence
 *     when a file will not read.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { todayLocal } from '@almari/shared/dates';
import { THEME_LABELS, type AppState } from '@almari/shared/types';

import { Button } from '../components/Button';
import { ConfirmSheet } from '../components/feed/ConfirmSheet';
import { Masthead } from '../components/Masthead';
import { showToast } from '../components/Toast';
import {
  commitImport,
  exportBackup,
  pickBackup,
  readActiveId,
  readWholeDocument,
  withLiveRecord,
} from '../lib/exportClient';
import { AccountPanel, Choice, TRUST_SENTENCE, useSession } from '../lib/session';
import { useWardrobe } from '../lib/wardrobe';
import { useFamilies } from '../tokens/FontsContext';
import {
  RADIUS,
  THEMES,
  THEME_ORDER,
  type ResolvedThemeName,
  type ThemeName,
} from '../tokens/themes';
import { useTheme } from '../tokens/ThemeContext';
import { TYPE } from '../tokens/typography';

export default function SettingsScreen() {
  const { tokens, theme, setTheme } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const { authUser, authReady } = useSession();
  const wardrobe = useWardrobe();
  const { wardrobeName, isSample, syncMode, setSyncMode, items, outfits, wearLogs, syncAccount } =
    wardrobe;
  // Chose "Synced to my account" while signed out: the choice cannot hold, so
  // the sign-in is offered instead of silently starting a sync that cannot
  // happen — the web's own wantSync gesture.
  const [wantSync, setWantSync] = useState(false);

  /* ---------- the record leaves, and comes back ---------- */

  const [pending, setPending] = useState<{ state: AppState; fileName: string } | null>(null);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  /**
   * The one part of the count this screen cannot see.
   *
   * The provider hands out items, outfits and wear logs; the wishlist lives in
   * the document and has no screen on this phone yet. The web counts all four
   * ("N records"), so the fourth is read off the shelf and the other three
   * stay live — the number is exact and it moves as the wardrobe moves.
   */
  const [shelfWishlist, setShelfWishlist] = useState(0);

  /**
   * THE PROVIDER HAS NO replaceState — reported as a contract mismatch, not
   * patched around silently. When squad A adds it, this reads it; until then
   * commitImport goes through the door a sync pull already uses.
   */
  const replaceState = (wardrobe as { replaceState?: (next: AppState) => void }).replaceState;

  const refreshShelfCount = useCallback(async () => {
    const shelf = await readWholeDocument(await readActiveId());
    setShelfWishlist(shelf.wishlist.length);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const shelf = await readWholeDocument(await readActiveId());
      if (!cancelled) setShelfWishlist(shelf.wishlist.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [items.length, outfits.length, wearLogs.length]);

  const records = items.length + outfits.length + wearLogs.length + shelfWishlist;

  const handleExport = useCallback(async () => {
    if (busy !== null) return;
    setBusy('export');
    try {
      // The SHELF is the whole document — it carries the wishlist, the circle,
      // the events and every key a newer build wrote. The provider's live
      // values go over the top so a wear logged a heartbeat ago is in the file.
      const shelf = await readWholeDocument(await readActiveId());
      const live = wardrobe as unknown as Partial<AppState>;
      const source = withLiveRecord(shelf, {
        items: live.items,
        outfits: live.outfits,
        wearLogs: live.wearLogs,
        settings: live.settings,
        // Landing with squad A this wave; undefined is skipped, never written.
        furniture: live.furniture,
      });
      const result = await exportBackup({
        source,
        wardrobeName,
        day: todayLocal(),
        exportedAt: new Date().toISOString(),
      });
      if (result.ok) {
        showToast(
          result.inlined > 0
            ? `Exported. ${result.records} records and ${result.inlined} photographs in one file.`
            : `Exported. ${result.records} records in one file.`,
          'success',
        );
        if (result.missing > 0) {
          showToast(
            `${result.missing} photographs were no longer on this device, so the file carries the pieces without them.`,
            'info',
          );
        }
        return;
      }
      showToast(
        result.reason === 'write-failed'
          ? 'This device would not take the write — its storage is full. Remove a few photographs, then export again.'
          : result.reason === 'no-share-sheet'
            ? 'This phone offers nowhere to send a file, so the backup has no way out of it.'
            : 'That did not reach the share sheet. Nothing left this device.',
        'error',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, wardrobe, wardrobeName]);

  const handleChooseFile = useCallback(async () => {
    if (busy !== null) return;
    setBusy('import');
    try {
      const picked = await pickBackup();
      // A picker closed on purpose is not news, and gets no sentence.
      if (!picked.ok) {
        if (picked.reason === 'unreadable') showToast('That file did not read as a backup.', 'error');
        return;
      }
      setPending({ state: picked.state, fileName: picked.fileName });
    } finally {
      setBusy(null);
    }
  }, [busy]);

  const confirmImport = useCallback(async () => {
    if (!pending) return;
    const arriving = pending.state;
    setPending(null);
    const outcome = await commitImport(
      {
        accountId: await readActiveId(),
        replaceState,
        syncAccount,
        authUserId: authUser?.id ?? null,
      },
      arriving,
    );
    if (outcome === 'replaced') {
      showToast(`Imported. ${arriving.items.length} pieces on record.`, 'success');
      await refreshShelfCount();
      return;
    }
    showToast(
      outcome === 'storage-full'
        ? 'This device would not take the write — its storage is full. Nothing was replaced. Remove a few photographs, then bring the backup in again.'
        : 'There is no wardrobe open to bring it into.',
      'error',
    );
  }, [pending, replaceState, syncAccount, authUser, refreshShelfCount]);

  /* ---------- the room this screen is shown in ---------- */

  /**
   * A room applies the moment it is pressed — there is nothing to confirm and
   * nothing to undo, because pressing another one is the undo. The only news
   * worth a sentence is a device that took the change but would not write it
   * down, which the reader would otherwise discover on the next cold open.
   */
  const chooseRoom = useCallback(
    async (name: ThemeName) => {
      if (name === theme) return;
      const outcome = await setTheme(name);
      if (outcome === 'unwritten') {
        showToast(
          'The room changed here, but this device would not write the choice down. It will open in the last room it saved.',
          'error',
        );
      }
    },
    [setTheme, theme],
  );

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
  const small = {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: tokens.text2,
  };
  const ledger = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
  };
  const plate = [
    styles.plate,
    { backgroundColor: tokens.surface, borderColor: tokens.border },
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {/* The way back. The one door into this room is the House's spool, so
            `back` is nearly always right; a settings link opened cold has
            nothing to pop and lands on Today, which is where every stranded
            address in this house lands. */}
        <View style={styles.leave}>
          <Button
            tone="tertiary"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
          >
            Back to the house
          </Button>
        </View>

        <Masthead title="Settings" meta="The house choices" />

        {/* The account — wholly optional, and the copy says what it is for. */}
        <View style={plate}>
          <Text style={editorial}>The account</Text>
          {!authReady ? (
            <Text style={body}>One moment — checking the account.</Text>
          ) : (
            <AccountPanel />
          )}
        </View>

        {/* Where the open wardrobe's record lives. */}
        <View style={[plate, { marginTop: 16 }]}>
          <Text style={editorial}>Where the record lives</Text>
          <Text style={[ledger, { marginBottom: 12 }]}>
            {wardrobeName ? `This wardrobe · ${wardrobeName}` : 'This wardrobe'}
          </Text>

          {isSample ? (
            <Text style={body}>
              A sample never syncs — a worked example belongs to the device that installed it.
            </Text>
          ) : (
            <>
              <View style={styles.choices}>
                <Choice
                  active={syncMode === 'device'}
                  onPress={() => {
                    setWantSync(false);
                    void setSyncMode('device');
                  }}
                >
                  On this device
                </Choice>
                <Choice
                  active={syncMode === 'cloud'}
                  onPress={() => {
                    // Signed out, the choice cannot hold — offer the sign-in
                    // instead of silently promising a sync with nowhere to go.
                    if (!authUser) {
                      setWantSync(true);
                      return;
                    }
                    setWantSync(false);
                    void setSyncMode('cloud');
                  }}
                >
                  Synced to my account
                </Choice>
              </View>
              <Text style={[small, { marginTop: 12 }]}>
                {syncMode === 'device'
                  ? 'Kept on this device only. If a copy was ever synced, it is left on the account as it was, and is no longer updated.'
                  : 'A copy is kept on your account, updated as you work, so another device can open it.'}
              </Text>
              {/* The plain sentence — docs/35: wherever sync is offered. */}
              <Text style={[small, { marginTop: 8 }]}>{TRUST_SENTENCE}</Text>
              {wantSync && !authUser ? (
                <View
                  style={[
                    styles.inset,
                    { backgroundColor: tokens.sunken, borderColor: tokens.border },
                  ]}
                >
                  <Text style={[ledger, { marginBottom: 12 }]}>
                    Syncing needs the account it syncs to
                  </Text>
                  <AccountPanel />
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* The room. A device choice, not a wardrobe one — and the copy is the
            web's own Appearance row, which names the six rooms rather than
            asking anyone to press seven swatches to find out. */}
        <View style={[plate, { marginTop: 16 }]}>
          <Text style={editorial}>The room</Text>
          <Text style={[ledger, { marginBottom: 12 }]}>This screen, not this wardrobe</Text>
          <Text style={body}>
            Six rooms in the same building: the pattern room where cloth is cut, the salon where a
            collection is shown, the gilding room where the gold leaf is laid, the dye house where
            the madder vats stain the walls rose, the obsidian where the glass reflects, and the
            atelier at night. The choice belongs to this screen, not to a wardrobe, so it holds
            when you open a different one.
          </Text>
          <View style={styles.rooms}>
            {THEME_ORDER.map(name => (
              <RoomRow
                key={name}
                name={name}
                selected={theme === name}
                onPress={() => void chooseRoom(name)}
              />
            ))}
          </View>
        </View>

        {/* Your data — the record leaves whole and comes back whole. */}
        <View style={[plate, { marginTop: 16 }]}>
          <Text style={editorial}>Your data</Text>
          <Text style={[ledger, { marginBottom: 12 }]}>{`${records} records`}</Text>

          <Text style={body}>
            One JSON file holding everything in this wardrobe: pieces, outfits, wear logs, the
            wishlist, your categories and tags. Photographs travel inside the file, so it opens on
            the web app with the pictures in it.
          </Text>
          <View style={styles.control}>
            <Button tone="primary" disabled={busy !== null} onPress={() => void handleExport()}>
              {busy === 'export' ? 'Exporting' : 'Export a backup'}
            </Button>
          </View>

          <View style={[styles.hairline, { borderColor: tokens.border }]} />

          <Text style={body}>
            Import reads a backup from any version of Almari and brings it forward. Fields it does
            not recognise are kept, not dropped.
          </Text>
          <View style={styles.control}>
            <Button disabled={busy !== null} onPress={() => void handleChooseFile()}>
              {busy === 'import' ? 'Choosing' : 'Choose a file'}
            </Button>
          </View>
        </View>

        {/* The gate. Exact counts, and the plain fact that there is no undo. */}
        <ConfirmSheet
          open={pending !== null}
          title="Bring in this backup"
          body={
            pending === null
              ? ''
              : `${pending.fileName}\n\nThat file holds ${pending.state.items.length} pieces, ${pending.state.outfits.length} outfits, ${pending.state.wearLogs.length} wear logs and ${pending.state.wishlist.length} wishlist entries. ${
                  records > 0
                    ? `Bringing it in replaces the ${records} records on this device now. There is no undo, and no other copy of them unless you exported one.`
                    : 'Nothing is on this device yet, so nothing is replaced.'
                }`
          }
          confirmLabel="Bring it in"
          onConfirm={() => void confirmImport()}
          onClose={() => setPending(null)}
        />

        {/* What the placeholder promised still stands; the list is not done.
            The room has landed, so only storage is still owed a sentence. */}
        <Text style={[ledger, { marginTop: 16 }]}>Storage will live here.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- the room, drawn in its own paint ---------- */

/**
 * One room, as a swatch: its surface, an ink hairline across it, and the
 * washing blue that carries its interface. Three tokens is the whole room in
 * miniature — the ground you read on, the rule that divides it, and the one
 * ink that means "press me" — and it is drawn rather than described because
 * no sentence tells you what the gilding room looks like.
 *
 * 'system' has no tokens of its own, so it draws as what it actually is: the
 * two rooms the device can hand back, side by side (resolveTheme sends
 * 'system' to the atelier at night or the pattern room, nowhere else).
 */
function Swatch({ rooms }: { rooms: ResolvedThemeName[] }) {
  return (
    <View style={styles.swatch}>
      {rooms.map(room => {
        const paint = THEMES[room];
        return (
          <View
            key={room}
            testID={`room-swatch-${room}`}
            style={[styles.swatchCell, { backgroundColor: paint.surface, borderColor: paint.border }]}
          >
            <View style={[styles.swatchRule, { backgroundColor: paint.inkFill }]} />
            <View style={[styles.swatchAccent, { backgroundColor: paint.accent }]} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * A room on the list. Selection sinks into the ground and takes the ink-weight
 * border — the Chip's law (brand law 3), never an accent fill, which here would
 * also fight the swatch it sits beside. The eyelet is the non-colour cue: a
 * punched hole, filled when this is the room you are in.
 */
function RoomRow({
  name,
  selected,
  onPress,
}: {
  name: ThemeName;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  /* The six rooms keep the house's own names (@almari/shared THEME_LABELS, the
     same list the House reads). 'system' does not: shared calls it "Follow the
     device" because a browser is a device's guest, and a phone IS the device. */
  const label = name === 'system' ? 'As the phone is' : THEME_LABELS[name];

  return (
    <Pressable
      testID={`room-row-${name}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.room,
        {
          borderColor: selected ? tokens.text : tokens.border,
          backgroundColor: selected ? tokens.sunken : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.eyelet,
          {
            borderColor: selected ? tokens.text : tokens.text2,
            backgroundColor: selected ? tokens.text : 'transparent',
          },
        ]}
      />
      <Swatch rooms={name === 'system' ? ['light', 'dark'] : [name]} />
      <Text
        style={{ fontFamily: fonts.ui, fontSize: TYPE.label, color: tokens.text, flexShrink: 1 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
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
  leave: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  plate: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 20,
    alignItems: 'stretch',
  },
  choices: {
    gap: 8,
    alignSelf: 'stretch',
  },
  inset: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    padding: 16,
    marginTop: 12,
  },
  control: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  rooms: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 12,
  },
  room: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    /* 44 is the floor, not a target — padding narrows, hit area never does. */
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
  },
  /* A punched hole — one of the two shapes allowed a circle. */
  eyelet: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  swatch: {
    width: 56,
    height: 32,
    flexDirection: 'row',
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  swatchCell: {
    flex: 1,
    paddingHorizontal: 5,
    paddingVertical: 6,
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatchRule: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  swatchAccent: {
    width: 14,
    height: 4,
  },
  /* Basting, restated: depth is a hairline, never a shadow. */
  hairline: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: 20,
  },
});
