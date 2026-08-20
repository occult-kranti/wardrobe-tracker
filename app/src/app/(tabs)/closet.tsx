/**
 * Closet — ports src/pages/Closet.tsx (docs/34 §2.2): the pieces as branded
 * tiles, a detail sheet with the facts and the "Worn today" action, and the
 * add-piece sheet with the minimal fields ("Name is the only required field;
 * everything else can arrive later", the web's own rule).
 *
 * Every number comes from @almari/shared: the specimen caption's
 * cost-per-wear via shared/cost, its phrasing via shared/similarity's
 * wearContext ("worn 14× · ₹3.12/wear"). Nothing is re-derived here.
 *
 * THIS WAVE ADDED THE PHOTOGRAPH, and with it three rules worth stating:
 *
 *  1. PERMISSION IS ASKED AT THE MOMENT OF USE, never on arrival. The SDK 57
 *     docs are explicit that launchCameraAsync does not request for you
 *     (https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/ — "Camera
 *     access always requires the user's permission"), and asking early is
 *     how an app trains people to refuse. A refusal is answered with a
 *     sentence and the other route, never a dead end and never a scold.
 *  2. THE FILE IS WRITTEN BEFORE THE RECORD. lib/photos.ts saves the bytes
 *     and hands back a path; the path is what `imageUrl` holds. A photograph
 *     attached and then abandoned ("Not now") is deleted on the way out —
 *     the sheet owns that file until the piece does.
 *  3. THE AI READS, IT NEVER WRITES. "Read it from a photograph" fills the
 *     form and stops. Every value it produced is sitting in an input the
 *     person can change, and nothing reaches the closet until they press
 *     "Add it" — the web's own law, carried over intact. The line under the
 *     button names the model, per docs/35.
 *
 * Web-only for now (named, not forgotten): the drawn garment plates, filters
 * and search, laundry, retire, favourites, the pass-it-on flow, and the
 * background cutout (canvas work — lib/cutout.ts has no native twin yet).
 */
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { costPerWear, formatPerWear, formatPrice, isRecordedAmount } from '@almari/shared/cost';
import { draftToItem, type IntakeDraft } from '@almari/shared/intake';
import { wearContext } from '@almari/shared/similarity';
import {
  categoryLabel,
  isQuietCategory,
  LAUNDRY_LABELS,
  PRESET_COLORS,
  SOURCE_LABELS,
  type AppSettings,
  type ClothingItem,
} from '@almari/shared/types';

import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { ConfirmSheet } from '../../components/feed/ConfirmSheet';
import { Masthead } from '../../components/Masthead';
import { showToast } from '../../components/Toast';
import { IconPlus } from '../../icons';
import { AI_DISCLOSURE, readPieceFromPhoto, SEND_QUALITY } from '../../lib/intakeClient';
import { photoUri, readPhotoAsDataUrl, removePhoto, savePhoto } from '../../lib/photos';
import { useWardrobe } from '../../lib/wardrobe';
import { useFamilies } from '../../tokens/FontsContext';
import { RADIUS } from '../../tokens/themes';
import { useTheme } from '../../tokens/ThemeContext';
import { TYPE } from '../../tokens/typography';

/** The room squad C is building. Linked by address only — see the chip row. */
const LOOKS_ROUTE = '/outfits' as Href;

/** Reads a YYYY-MM-DD local date without the toISOString day-shift. */
function readableDate(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Brand, or the maker when it's self-made — ports Closet.tsx makerLabel. */
function makerLabel(item: ClothingItem): string | null {
  if (item.source === 'self-made') return SOURCE_LABELS['self-made'];
  const brand = item.brand?.trim();
  return brand ? brand : null;
}

/**
 * The specimen caption — ports Closet.tsx specimenCaption: wears, and
 * cost-per-wear only once that number means something.
 */
function specimenCaption(item: ClothingItem): string {
  const cpwMeaningful = costPerWear(item).reason === 'ok';
  const wears =
    item.wearCount === 0 || cpwMeaningful
      ? wearContext(item)
      : `${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`;
  const maker = makerLabel(item);
  return maker ? `${maker} · ${wears}` : wears;
}

/* ---------- the photograph, and what stands in for one ---------- */

/** The colour as a swatch — flat, radius 2, a hairline edge. Data, not a token. */
function Swatch({ color, size = 40 }: { color: string; size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: Math.round(size * 1.25),
        borderRadius: RADIUS,
        backgroundColor: color,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tokens.border,
      }}
    />
  );
}

/**
 * A piece's photograph, or the flat that stands in for one.
 *
 * Brand law 6: nothing decorative behind clothing photos — the tile is flat
 * `mat`, a hairline edge, radius 2, no shadow. The fallback is not an error
 * state and is never labelled as a gap: a piece with no photograph is a
 * perfectly ordinary piece, and the colour swatch says something true about
 * it. photoUri answers for a stored path AND for the data URI a wardrobe
 * synced down from the web holds, so one call site draws either.
 */
function PieceImage({ item, size = 40 }: { item: ClothingItem; size?: number }) {
  const { tokens } = useTheme();
  const uri = photoUri(item.imageUrl ?? '');
  if (!uri) return <Swatch color={item.color} size={size} />;
  return (
    <View
      style={{
        width: size,
        height: Math.round(size * 1.25),
        borderRadius: RADIUS,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tokens.border,
        backgroundColor: tokens.mat,
        overflow: 'hidden',
      }}
    >
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={`Photograph of ${item.name}`}
        source={{ uri }}
        resizeMode="cover"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

/* ---------- the picker ---------- */

export type PhotoSource = 'camera' | 'library';

export type PickResult =
  | { kind: 'picked'; uri: string }
  | { kind: 'cancelled' }
  | { kind: 'refused'; message: string };

/**
 * Ask, then open. In that order, and only when a person has just pressed the
 * button that needs it.
 *
 * Checked against https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
 * this session: requestCameraPermissionsAsync() /
 * requestMediaLibraryPermissionsAsync() answer a PermissionResponse whose
 * `granted` is the whole question; launchCameraAsync /
 * launchImageLibraryAsync answer `{ canceled, assets }` with assets null on
 * cancel; `mediaTypes` in SDK 57 takes the string form `['images']`, not the
 * deprecated MediaTypeOptions enum. `quality` is the only shrink available
 * in Expo Go (see intakeClient SEND_QUALITY) — there is no canvas here and
 * expo-image-manipulator is not a dependency of this app.
 *
 * A refusal is a sentence, not a dead end: the copy points at the phone's own
 * settings and at the other route, and never suggests the person did
 * something wrong by saying no.
 */
export async function pickPhotograph(source: PhotoSource): Promise<PickResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return {
      kind: 'refused',
      message:
        source === 'camera'
          ? 'The camera is not open to Almari. Your phone’s settings can change that — or choose a photograph from the library instead.'
          : 'The photo library is not open to Almari. Your phone’s settings can change that — or take a photograph instead.',
    };
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: SEND_QUALITY })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: SEND_QUALITY });

  if (result.canceled) return { kind: 'cancelled' };
  const uri = result.assets?.[0]?.uri;
  if (!uri) return { kind: 'cancelled' };
  return { kind: 'picked', uri };
}

/** The base64 payload of a data URI, in the shape the relay wants. */
function splitDataUrl(dataUrl: string): { base64: string; mediaType: string } | null {
  const head = /^data:([^;,]*)(;[^,]*)?,/i.exec(dataUrl);
  if (!head) return null;
  const base64 = dataUrl.slice(head[0].length);
  if (!base64) return null;
  return { base64, mediaType: head[1] || 'image/jpeg' };
}

/* ---------- plates and rows ---------- */

function ClosetRow({
  item,
  settings,
  onOpen,
}: {
  item: ClothingItem;
  settings: AppSettings;
  onOpen: () => void;
}) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        pressed && { backgroundColor: tokens.sunken },
      ]}
    >
      <PieceImage item={item} />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text }}>
          {item.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.mono,
            fontSize: TYPE.ledgerMeta,
            letterSpacing: TYPE.ledgerSpacing,
            textTransform: 'uppercase',
            color: tokens.text2,
            marginTop: 4,
          }}
        >
          {categoryLabel(settings, item.category)} · {specimenCaption(item)}
        </Text>
      </View>
    </Pressable>
  );
}

/** One ledger line in the detail sheet: a mono label, a plain value. */
function Fact({ label, value }: { label: string; value: string }) {
  const { tokens } = useTheme();
  const fonts = useFamilies();
  return (
    <View style={styles.fact}>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: TYPE.ledgerMeta,
          letterSpacing: TYPE.ledgerSpacing,
          textTransform: 'uppercase',
          color: tokens.text2,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontFamily: fonts.ui, fontSize: 15, color: tokens.text }}>{value}</Text>
    </View>
  );
}

/** The bottom plate both sheets sit on: hairline edge, radius 2, no shadow. */
function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  if (!open) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

/* ---------- the detail sheet ---------- */

function DetailSheet({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  const { getItem, settings, logWear, setItemPhoto, removeItemPhoto } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const item = itemId ? getItem(itemId) : undefined;
  if (!item) return null;

  const hasPhoto = photoUri(item.imageUrl ?? '') !== null;

  const attach = async (source: PhotoSource) => {
    setNote(null);
    setBusy(true);
    try {
      const picked = await pickPhotograph(source);
      if (picked.kind === 'refused') {
        setNote(picked.message);
        return;
      }
      if (picked.kind === 'cancelled') return;
      await setItemPhoto(item.id, picked.uri);
      showToast(hasPhoto ? 'Replaced. The old photograph is gone.' : 'Photographed.', 'success');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'That photograph would not save. Nothing changed.');
    } finally {
      setBusy(false);
    }
  };

  const cpw = costPerWear(item);
  const facts: Array<[string, string]> = [
    ['Category', categoryLabel(settings, item.category)],
    ['Wears', String(item.wearCount)],
  ];
  if (isRecordedAmount(item.cost)) facts.push(['Cost', formatPrice(item.cost)]);
  // Per-wear only once it means something — the caption rule, held here too.
  if (cpw.reason === 'ok') facts.push(['Per wear', `${formatPerWear(cpw.value)}/wear`]);
  if (item.lastWorn) facts.push(['Last worn', readableDate(item.lastWorn)]);
  if (item.laundryStatus !== 'clean') facts.push(['Standing', LAUNDRY_LABELS[item.laundryStatus]]);
  facts.push(['Added', readableDate(item.dateAdded)]);

  return (
    <Sheet open onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
          <PieceImage item={item} size={56} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.displayItalic,
                fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                fontSize: TYPE.editorial,
                color: tokens.text,
              }}
            >
              {item.name}
            </Text>
            {item.notes ? (
              <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: tokens.text2, marginTop: 4 }}>
                {item.notes}
              </Text>
            ) : null}
          </View>
        </View>

        {/* The photograph's own controls. Quiet tones on purpose: the one
            accent fill in this view belongs to "Worn today" (brand law 3). */}
        <View style={styles.photoRow}>
          <Button tone="secondary" compact disabled={busy} onPress={() => void attach('camera')}>
            {hasPhoto ? 'Photograph it again' : 'Photograph it'}
          </Button>
          <Button tone="secondary" compact disabled={busy} onPress={() => void attach('library')}>
            {hasPhoto ? 'Choose another' : 'Choose a photograph'}
          </Button>
          {hasPhoto ? (
            <Button tone="tertiary" compact disabled={busy} onPress={() => setConfirmRemove(true)}>
              Remove the photograph
            </Button>
          ) : null}
        </View>
        {note ? (
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13,
              lineHeight: 20,
              color: tokens.text2,
              marginTop: 8,
            }}
          >
            {note}
          </Text>
        ) : null}

        <View style={[styles.factList, { borderColor: tokens.border }]}>
          {facts.map(([label, value]) => (
            <Fact key={label} label={label} value={value} />
          ))}
        </View>
        <View style={styles.sheetFooter}>
          <Button tone="tertiary" onPress={onClose}>
            Close
          </Button>
          {/* The one sanctioned hero fill: a log-wear action (brand law 3). */}
          <Button
            tone="hero"
            onPress={() => {
              logWear([item.id]);
              const total = item.wearCount + 1;
              showToast(`Logged. Worn ${total} ${total === 1 ? 'time' : 'times'}.`, 'seal');
              onClose();
            }}
          >
            Worn today
          </Button>
        </View>
      </ScrollView>

      {/* Removing a photograph takes a file off the disk and cannot be
          undone from here, so it is stated plainly and confirmed. The piece
          itself is untouched — the copy says which of the two is going. */}
      <ConfirmSheet
        open={confirmRemove}
        title="Remove the photograph"
        body={`The photograph of ${item.name} comes off this device. The piece keeps its name, its wears and everything else — only the picture goes.`}
        confirmLabel="Remove it"
        onConfirm={() => {
          setConfirmRemove(false);
          void removeItemPhoto(item.id).then(() => {
            showToast('Removed. The piece keeps everything else.', 'info');
          });
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </Sheet>
  );
}

/* ---------- the add sheet ---------- */

function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, addItem } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(settings.categories[0]?.id ?? 'tops');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  /** The file this sheet owns until a piece does. Cleared, not deleted, on submit. */
  const [photoPath, setPhotoPath] = useState('');
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** The reading, kept so the fields the form has no input for can ride along. */
  const [read, setRead] = useState<IntakeDraft | null>(null);
  const [reading, setReading] = useState(false);
  const [readFailed, setReadFailed] = useState<string | null>(null);
  const [readNote, setReadNote] = useState<string | null>(null);

  const categories = settings.categories.filter(c => !isQuietCategory(settings, c.id));

  const fieldLabel = {
    fontFamily: fonts.mono,
    fontSize: TYPE.ledgerMeta,
    letterSpacing: TYPE.ledgerSpacing,
    textTransform: 'uppercase' as const,
    color: tokens.text2,
    marginBottom: 8,
  };

  const clear = () => {
    setName('');
    setPrice('');
    setNotes('');
    setHint(null);
    setPhotoPath('');
    setPhotoNote(null);
    setRead(null);
    setReadFailed(null);
    setReadNote(null);
  };

  /**
   * Leaving without adding. The photograph this sheet attached belongs to
   * nothing now, so it comes off the disk on the way out — an orphaned file
   * is invisible, and invisible files are how a phone quietly fills up.
   */
  const leave = () => {
    const orphan = photoPath;
    clear();
    onClose();
    if (orphan) void removePhoto(orphan);
  };

  const attach = async (source: PhotoSource) => {
    setPhotoNote(null);
    setBusy(true);
    try {
      const picked = await pickPhotograph(source);
      if (picked.kind === 'refused') {
        setPhotoNote(picked.message);
        return;
      }
      if (picked.kind === 'cancelled') return;
      const path = await savePhoto(picked.uri);
      const previous = photoPath;
      setPhotoPath(path);
      // A new photograph is a new subject: the old reading no longer describes
      // what is on screen, so it goes rather than sitting there looking true.
      setRead(null);
      setReadNote(null);
      setReadFailed(null);
      if (previous) await removePhoto(previous);
    } catch (e) {
      setPhotoNote(
        e instanceof Error ? e.message : 'That photograph would not save. Nothing changed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const dropPhoto = () => {
    const orphan = photoPath;
    setPhotoPath('');
    setRead(null);
    setReadNote(null);
    setReadFailed(null);
    if (orphan) void removePhoto(orphan);
  };

  /**
   * Let the photograph do the typing.
   *
   * ONE journey out, and what comes back lands in the fields as a DRAFT.
   * Nothing is saved by this button — the person still has to press "Add it",
   * and every value is still sitting in an input they can change first.
   */
  const readIt = async () => {
    if (!photoPath || reading) return;
    setReadFailed(null);
    setReadNote(null);
    setReading(true);
    try {
      const dataUrl = await readPhotoAsDataUrl(photoPath);
      const parts = dataUrl ? splitDataUrl(dataUrl) : null;
      if (!parts) {
        setReadFailed('That photograph is no longer on this device. Attach it again.');
        return;
      }
      const { draft, found } = await readPieceFromPhoto(parts);
      setRead(draft);
      setName(draft.name);
      // Only a category this wardrobe actually keeps: the model answers with
      // the shared default ids, and a wardrobe may have renamed or retired
      // any of them.
      if (categories.some(c => c.id === draft.category)) setCategory(draft.category);
      if (draft.color) setColor(draft.color);
      const composed = draftToItem(draft).notes;
      if (composed) setNotes(composed);
      if (found > 1) {
        setReadNote(
          `Found ${found} pieces in that photograph and filled in the clearest one. Change anything that is wrong before you add it.`,
        );
      } else {
        setReadNote('Filled in from the photograph. Change anything that is wrong before you add it.');
      }
    } catch (e) {
      setReadFailed(
        e instanceof Error ? e.message : 'That did not work. Nothing was changed.',
      );
    } finally {
      setReading(false);
    }
  };

  const submit = () => {
    const trimmed = name.trim();
    // Name is the only required field — and a refusal says what is missing
    // rather than sitting disabled (the web door's own rule).
    if (!trimmed) {
      setHint('A name is all it needs to start.');
      return;
    }
    const parsedPrice = price.trim() === '' ? undefined : Number(price.trim());
    // What the model read rides underneath; what is on screen wins over it,
    // because what is on screen is what the person agreed to.
    const fromRead = read ? draftToItem(read) : null;
    const trimmedNotes = notes.trim();
    addItem({
      ...(fromRead ?? {}),
      name: trimmed,
      category,
      color,
      season: fromRead?.season ?? [],
      occasion: fromRead?.occasion ?? [],
      imageUrl: photoPath,
      favorite: false,
      ...(trimmedNotes ? { notes: trimmedNotes } : { notes: undefined }),
      ...(isRecordedAmount(parsedPrice) ? { cost: parsedPrice } : {}),
    });
    showToast('Added. It starts at 0 wears.', 'success');
    clear();
    onClose();
  };

  const preview = photoPath ? photoUri(photoPath) : null;

  return (
    <Sheet open={open} onClose={leave}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: TYPE.editorial,
            color: tokens.text,
            marginBottom: 16,
          }}
        >
          Add a piece
        </Text>

        {/* THE PHOTOGRAPH — optional, and it has to look like a choice rather
            than a gap (docs/06 §1). With none chosen there is no empty frame
            standing there looking broken; there are two plain offers. */}
        <Text style={fieldLabel}>Photograph</Text>
        <View style={styles.photoRow}>
          {preview ? (
            <View
              style={{
                width: 56,
                height: 70,
                borderRadius: RADIUS,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: tokens.border,
                backgroundColor: tokens.mat,
                overflow: 'hidden',
              }}
            >
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel="The photograph you attached"
                source={{ uri: preview }}
                resizeMode="cover"
                style={{ width: '100%', height: '100%' }}
              />
            </View>
          ) : null}
          <Button tone="secondary" compact disabled={busy} onPress={() => void attach('camera')}>
            {photoPath ? 'Photograph it again' : 'Photograph it'}
          </Button>
          <Button tone="secondary" compact disabled={busy} onPress={() => void attach('library')}>
            {photoPath ? 'Choose another' : 'Choose a photograph'}
          </Button>
          {photoPath ? (
            <Button tone="tertiary" compact disabled={busy} onPress={dropPhoto}>
              Without a photograph
            </Button>
          ) : null}
        </View>
        {photoNote ? (
          <Text
            style={{
              fontFamily: fonts.ui,
              fontSize: 13,
              lineHeight: 20,
              color: tokens.text2,
              marginTop: 8,
            }}
          >
            {photoNote}
          </Text>
        ) : null}

        {/* The AI read, offered only once there is a photograph to read. */}
        {photoPath ? (
          <View style={[styles.readBlock, { borderColor: tokens.border }]}>
            <Button tone="secondary" compact disabled={reading} onPress={() => void readIt()}>
              {reading ? 'Reading the photograph…' : 'Read it from a photograph'}
            </Button>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: 13,
                lineHeight: 20,
                color: tokens.text2,
                marginTop: 8,
              }}
            >
              {AI_DISCLOSURE}
            </Text>
            {readNote ? (
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 13,
                  lineHeight: 20,
                  color: tokens.text2,
                  marginTop: 8,
                }}
              >
                {readNote}
              </Text>
            ) : null}
            {readFailed ? (
              <Text
                style={{
                  fontFamily: fonts.ui,
                  fontSize: 13,
                  lineHeight: 20,
                  color: tokens.danger,
                  marginTop: 8,
                }}
              >
                {readFailed}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={[fieldLabel, { marginTop: 16 }]}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          placeholder="What the piece is called"
          placeholderTextColor={tokens.text2}
          style={[
            styles.input,
            { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
          ]}
        />
        {hint ? (
          <Text style={{ fontFamily: fonts.ui, fontSize: 13, color: tokens.warning, marginTop: 6 }}>
            {hint}
          </Text>
        ) : null}

        <Text style={[fieldLabel, { marginTop: 16 }]}>Category</Text>
        <View style={styles.chipRow}>
          {categories.map(c => (
            <Chip key={c.id} selected={category === c.id} onPress={() => setCategory(c.id)}>
              {c.label}
            </Chip>
          ))}
        </View>

        <Text style={[fieldLabel, { marginTop: 16 }]}>Colour</Text>
        <View style={styles.chipRow}>
          {PRESET_COLORS.map(c => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              accessibilityState={{ selected: color === c }}
              onPress={() => setColor(c)}
              style={{
                width: 44,
                height: 44,
                borderRadius: RADIUS,
                backgroundColor: c,
                borderWidth: color === c ? 2 : StyleSheet.hairlineWidth,
                borderColor: color === c ? tokens.text : tokens.border,
              }}
            />
          ))}
          {/* A colour sampled from the photograph is rarely one of the six.
              It gets its own swatch rather than leaving the row looking
              unselected — the reading has to be visible to be correctable. */}
          {!PRESET_COLORS.includes(color) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Colour read from the photograph, ${color}`}
              accessibilityState={{ selected: true }}
              onPress={() => undefined}
              style={{
                width: 44,
                height: 44,
                borderRadius: RADIUS,
                backgroundColor: color,
                borderWidth: 2,
                borderColor: tokens.text,
              }}
            />
          ) : null}
        </View>

        <Text style={[fieldLabel, { marginTop: 16 }]}>Notes</Text>
        <TextInput
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Optional. One line about the piece."
          placeholderTextColor={tokens.text2}
          style={[
            styles.input,
            styles.notesInput,
            { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
          ]}
        />

        <Text style={[fieldLabel, { marginTop: 16 }]}>Price</Text>
        <TextInput
          accessibilityLabel="Price"
          value={price}
          onChangeText={setPrice}
          placeholder="Optional. A recorded 0 is a real answer."
          placeholderTextColor={tokens.text2}
          keyboardType="numeric"
          style={[
            styles.input,
            { borderColor: tokens.border, color: tokens.text, fontFamily: fonts.ui },
          ]}
        />

        <View style={styles.sheetFooter}>
          <Button tone="tertiary" onPress={leave}>
            Not now
          </Button>
          <Button tone="primary" onPress={submit}>
            Add it
          </Button>
        </View>
      </ScrollView>
    </Sheet>
  );
}

/* ---------- the room ---------- */

/**
 * The looks rail — a hook into the room squad C builds, linked BY ADDRESS
 * ONLY. This file knows the path and nothing else about /outfits: no import,
 * no shared component, no assumption about what is on the other side.
 */
function LooksRail() {
  const { outfits } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const router = useRouter();
  const go = () => router.push(LOOKS_ROUTE);

  return (
    <View style={styles.looksRail}>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: TYPE.ledgerMeta,
          letterSpacing: TYPE.ledgerSpacing,
          textTransform: 'uppercase',
          color: tokens.text2,
          marginBottom: 8,
        }}
      >
        Looks
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.railRow}
      >
        {outfits.slice(0, 8).map(o => (
          <Chip key={o.id} onPress={go}>
            {o.name}
          </Chip>
        ))}
        <Chip onPress={go}>{outfits.length > 0 ? 'All looks' : 'Build a look'}</Chip>
      </ScrollView>
    </View>
  );
}

export default function ClosetScreen() {
  const { activeItems, settings } = useWardrobe();
  const { tokens } = useTheme();
  const fonts = useFamilies();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const sorted = useMemo(
    () => [...activeItems].sort((a, b) => a.name.localeCompare(b.name)),
    [activeItems],
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <View style={styles.page}>
        <Masthead title="Closet" meta="Every piece, once" />
        <LooksRail />
        {sorted.length === 0 ? (
          <View
            style={[styles.plate, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          >
            <Text
              style={{
                fontFamily: fonts.displayItalic,
                fontStyle: fonts.displayItalic === 'Fraunces-Italic' ? 'normal' : 'italic',
                fontSize: TYPE.editorial,
                color: tokens.text,
                marginBottom: 8,
              }}
            >
              Nothing hangs here yet.
            </Text>
            <Text
              style={{
                fontFamily: fonts.ui,
                fontSize: TYPE.body,
                lineHeight: Math.round(TYPE.body * 1.5),
                color: tokens.text2,
                marginBottom: 16,
              }}
            >
              One piece is enough to start: a name, and a photo if you have one. The ledger counts
              from its first wear.
            </Text>
            <Button
              tone="primary"
              icon={<IconPlus size={16} color={tokens.onInk} />}
              onPress={() => setAddOpen(true)}
            >
              Add a piece
            </Button>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <ClosetRow item={item} settings={settings} onOpen={() => setDetailId(item.id)} />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListFooterComponent={
              <View style={{ marginTop: 16, alignItems: 'flex-start' }}>
                <Button
                  tone="primary"
                  icon={<IconPlus size={16} color={tokens.onInk} />}
                  onPress={() => setAddOpen(true)}
                >
                  Add a piece
                </Button>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
      <DetailSheet itemId={detailId} onClose={() => setDetailId(null)} />
      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    minHeight: 44,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  looksRail: {
    marginBottom: 16,
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 20,
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
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  readBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  factList: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  sheetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 66,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
