import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { showToast } from '../components/Toast';
import { Button, Chip, LinkButton, Masthead, EmptyState } from '../components/ui';
import { Basting, GarmentPlate, PlateEmptyCloset } from '../components/art';
import { IconCheck, IconClose, IconImport, IconCopy, IconCamera, IconChevronLeft, IconFeed } from '../components/icons';
import { categoryLabel, displayTag, PRESET_COLORS, SEASON_LABELS, type CategoryId } from '@almari/shared/types';
import {
  readIntake, draftToItem, findDuplicates,
  type IntakeDraft, type IntakeRead, type IntakeSkip,
} from '@almari/shared/intake';
import { INTAKE_PROMPT, OUTFIT_PROMPT } from '../lib/intakePrompt';
import { INTAKE_SAMPLES, type IntakeSample } from '../lib/intakeSamples';
import { prepareImage, readPhotograph, type Prepared } from '../lib/anthropic';
import { harvest, type Harvested } from '../lib/harvest';
import { confirmWrite } from '../hooks/useLocalStorage';
import { storePhoto } from '../lib/photoStore';
import {
  buildGridPrompt, parseGridResponse, soloDetections, toDrafts,
  buildPhotoPrompt, galleryDrafts, photoCropPixels,
  tileCropPixels, garmentCropPixels,
  type Detection,
} from '../lib/feedIntake';

/**
 * CATALOGUE FROM PHOTOS — the review bench.
 *
 * A vision model reads a photograph of the clothes and hands over a file
 * (docs/23-photo-intake.md). This page is the step between that file and the
 * closet, and it is not a formality: the model is a fast, confident stranger
 * who has never seen these clothes before. Everything arrives ticked or
 * unticked with its doubts stated, and nothing is written until the owner
 * says so.
 *
 * Low confidence and named uncertainties are shown, never hidden behind a
 * spinner-and-success story. Pieces whose names already exist arrive unticked.
 */

function confidenceWord(c: number): string {
  if (c >= 0.85) return 'clear';
  if (c >= 0.7) return 'fair';
  if (c >= 0.55) return 'unsure';
  return 'a guess';
}

/**
 * Cut a pixel box out of an image and hand back a JPEG no bigger than
 * maxEdge on a side. Feed imports store one of these per piece: a screenshot
 * is too big to keep, the crop of one garment is not.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('That photograph would not open.'));
    el.src = src;
  });
}

async function cropPixels(
  src: string,
  px: { x: number; y: number; w: number; h: number },
  maxEdge = 520,
): Promise<string> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxEdge / Math.max(px.w, px.h));
  const w = Math.max(1, Math.round(px.w * scale));
  const h = Math.max(1, Math.round(px.h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser will not open a drawing surface.');
  ctx.drawImage(img, px.x, px.y, px.w, px.h, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.88);
}

/** What a feed import is doing right now, said plainly rather than as a spinner. */
type FeedWork =
  | { at: 'idle' }
  | { at: 'reading'; done: number; total: number }
  | { at: 'cutting'; done: number; total: number };

/** A feed screenshot is a page of posts; nine at a time is plenty of grid. */
const FEED_LIMIT = 9;

/** Gallery photographs are one read each; nine at a time is plenty of film. */
const GALLERY_LIMIT = 9;

/** What the reader is doing right now, said plainly rather than as a spinner. */
type Working =
  | { at: 'idle' }
  | { at: 'sending' }
  | { at: 'cutting'; done: number; total: number };

export default function Intake() {
  const { addItem, addOutfit, logWear, activeItems, settings } = useWardrobe();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Arriving from "Today's outfit" in the closet.
  const worn = params.get('worn') === '1';
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [result, setResult] = useState<IntakeRead | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, Partial<IntakeDraft>>>({});
  const [copied, setCopied] = useState(false);
  const [tried, setTried] = useState<IntakeSample | null>(null);

  /* ---------- reading a photograph here, rather than sending you elsewhere ---------- */
  const [working, setWorking] = useState<Working>({ at: 'idle' });
  const [failure, setFailure] = useState<string | null>(null);
  /** The photograph that was read, kept so the bench can show what it came from. */
  const [source, setSource] = useState<string | null>(null);
  /** One picture per piece, cut from that photograph on this device. */
  const [pictures, setPictures] = useState<Map<string, Harvested>>(new Map());
  const [saveLook, setSaveLook] = useState(true);
  /** Worn flow only: the wear the photograph is evidence of, offered as a tick. */
  const [logToday, setLogToday] = useState(true);

  /* ---------- a feed screenshot: a whole grid at once ---------- */
  const [feed, setFeed] = useState<FeedWork>({ at: 'idle' });
  const [feedFailure, setFeedFailure] = useState<string | null>(null);
  /** True when the bench is reviewing a feed import — the banner speaks of screenshots. */
  const [feedMode, setFeedMode] = useState(false);
  const feedRef = useRef<HTMLInputElement>(null);
  const feedCardRef = useRef<HTMLDivElement>(null);

  /* ---------- your own gallery: many photographs, one read each ---------- */
  const [gal, setGal] = useState<FeedWork>({ at: 'idle' });
  const [galFailure, setGalFailure] = useState<string | null>(null);
  /** True when the bench is reviewing a gallery import — the banner speaks of photographs. */
  const [galleryMode, setGalleryMode] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const galleryCardRef = useRef<HTMLDivElement>(null);

  /**
   * A worn read, and only a worn read.
   *
   * `worn` is a URL parameter, so it outlives a Start over and stays true
   * through a feed or gallery import begun on the same page — and neither of
   * those is a photograph of what you have on.
   */
  const wornRead = worn && !feedMode && !galleryMode;

  // The closet's "From a feed" and "From photos" links land here, on their cards.
  useEffect(() => {
    if (params.get('feed') === '1') feedCardRef.current?.scrollIntoView({ block: 'start' });
    if (params.get('photos') === '1') galleryCardRef.current?.scrollIntoView({ block: 'start' });
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The closet's "Today's outfit" opens the camera straight away — the button
  // was the decision; making someone press a second one is just friction.
  useEffect(() => {
    if (worn && !result) photoRef.current?.click();
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const duplicates = useMemo(
    () => (result ? findDuplicates(result.drafts, activeItems) : new Set<string>()),
    [result, activeItems]
  );

  const readFile = (raw: string) => {
    const r = readIntake(raw);
    setResult(r);
    setEdited({});
    setFeedMode(false);
    setGalleryMode(false);
    // THE CROPS BELONG TO THE PHOTOGRAPH THEY CAME FROM, AND TO NOTHING ELSE.
    // Draft refs are p1, p2, p3 — the parser's own numbering, and the bundled
    // samples use exactly those — so a read that begins while the last read's
    // pictures are still here would hand a photograph of your jacket to
    // somebody else's sample trousers, and commit it. Cleared where every new
    // read begins, which is here.
    setPictures(new Map());
    setSource(null);
    if (r.error) {
      setTicked(new Set());
      return;
    }
    // Everything the model was reasonably sure of, and that we do not already
    // own, arrives ticked. The rest waits for a human to look at it.
    const dupes = findDuplicates(r.drafts, activeItems);
    setTicked(new Set(r.drafts.filter(d => d.confidence >= 0.55 && !dupes.has(d.ref)).map(d => d.ref)));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const raw = await file.text();
    setText(raw);
    readFile(raw);
  };

  /**
   * Read a photograph, end to end.
   *
   * One journey out: the photograph goes to the AI provider — the relay, or
   * the endpoint set in Settings — and comes back as coordinates and words.
   * Everything after that — cropping each piece, lifting it off its
   * background, writing it into the closet — happens here, on this device.
   */
  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    if (!file.type.startsWith('image/')) {
      setFailure('That file is not a photograph. A JPG or PNG works.');
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve((e.target?.result as string) ?? '');
      reader.onerror = () => reject(new Error('That photograph would not open.'));
      reader.readAsDataURL(file);
    }).catch(() => '');
    if (!dataUrl) {
      setFailure('That photograph would not open. Try another.');
      return;
    }

    try {
      setWorking({ at: 'sending' });
      const image = await prepareImage(dataUrl);
      const { text: answer } = await readPhotograph(image, worn ? OUTFIT_PROMPT : INTAKE_PROMPT);
      setText(answer);

      const read = readIntake(answer);
      if (read.error) {
        setWorking({ at: 'idle' });
        setFailure(`${read.error} The model's answer is in the box below if you want to look.`);
        setResult(read);
        return;
      }

      // The crop reads from the image that was actually sent, so the boxes and
      // the pixels are the same picture.
      setSource(image.dataUrl);
      setWorking({ at: 'cutting', done: 0, total: read.drafts.filter(d => d.box).length });
      const cut = await harvest(image.dataUrl, read.drafts, (done, total) =>
        setWorking({ at: 'cutting', done, total }));
      setPictures(cut);

      setResult(read);
      setEdited({});
      setFeedMode(false);
      setGalleryMode(false);
      const dupes = findDuplicates(read.drafts, activeItems);
      setTicked(new Set(read.drafts.filter(d => d.confidence >= 0.55 && !dupes.has(d.ref)).map(d => d.ref)));
      setTried(null);
      setWorking({ at: 'idle' });
    } catch (e) {
      setWorking({ at: 'idle' });
      setFailure(e instanceof Error ? e.message : 'That did not work. Nothing was changed.');
    }
  };

  /**
   * Read one or more feed screenshots, end to end.
   *
   * One journey out PER SCREENSHOT, declared on the card before the button.
   * What comes back is the grid read as tiles; the solo rule is enforced
   * twice (the prompt asks, the parser guarantees), and every piece is cut
   * out here, on this device. Everything lands on this same bench as a
   * draft — nothing is written until the owner says so.
   */
  const onFeed = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFailure(null);
    setFeedFailure(
      files.length > FEED_LIMIT ? `Nine at a time — the first ${FEED_LIMIT} were taken.` : null
    );

    const images = [...files].slice(0, FEED_LIMIT).filter(f => f.type.startsWith('image/'));
    if (!images.length) {
      setFeedFailure('None of those files is a photograph. A JPG or PNG works.');
      return;
    }

    const skipped: IntakeSkip[] = [];
    const droppedRows: Array<{ index: number; reason: string }> = [];
    const photos: Array<{ n: number; note?: string }> = [];
    const detections: Detection[] = [];
    // Indexed by screenshot number, so a screenshot that fails to read can
    // never shift which image a later tile is cut from.
    const shots: Array<Prepared | null> = [];
    const unreadable: string[] = [];

    try {
      setFeed({ at: 'reading', done: 0, total: images.length });
      for (let i = 0; i < images.length; i++) {
        const n = i + 1;
        photos.push({ n, note: images[i].name });
        shots.push(null);
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve((e.target?.result as string) ?? '');
            reader.onerror = () => reject(new Error('That screenshot would not open.'));
            reader.readAsDataURL(images[i]);
          });
          const image = await prepareImage(dataUrl);
          shots[i] = image;
          const { text: answer } = await readPhotograph(image, buildGridPrompt());
          setText(answer);

          const read = parseGridResponse(answer);
          if (read.error) {
            skipped.push({ reason: 'That screenshot would not read', note: read.error, photo: n });
          } else {
            for (const tile of read.tiles) {
              // Listed, never processed: the solo rule, said out loud per tile.
              if (tile.kind === 'group') skipped.push({ reason: 'Left alone — a group photo.', photo: n });
              else if (tile.kind === 'scenery') skipped.push({ reason: 'Left alone — no clothes are the subject.', photo: n });
              else if (tile.kind === 'text') skipped.push({ reason: 'Left alone — a text post.', photo: n });
              else if (tile.kind === 'other') skipped.push({ reason: 'Left alone — not a solo post.', photo: n });
            }
            droppedRows.push(...read.dropped.map((row, ri) => ({ index: ri, reason: `${row.ref}: ${row.reason}` })));
            detections.push(...soloDetections(read, n));
          }
        } catch (e) {
          unreadable.push(e instanceof Error ? e.message : 'That did not work.');
          skipped.push({ reason: 'That screenshot would not read', photo: n });
        }
        setFeed({ at: 'reading', done: n, total: images.length });
      }

      // Every screenshot failing the journey is a failure, not an empty bench.
      if (!detections.length && unreadable.length === images.length) {
        setFeed({ at: 'idle' });
        setFeedFailure(unreadable[0]);
        return;
      }

      const mapped = toDrafts(detections);
      droppedRows.push(...mapped.dropped.map((row, ri) => ({ index: 1000 + ri, reason: `${row.ref}: ${row.reason}` })));
      for (const dupe of mapped.dupes) {
        skipped.push({
          reason: 'Already in this import — not added twice.',
          note: `${dupe.name}, seen again in screenshot ${dupe.screenshot}`,
        });
      }

      // The crops: the garment's own box when the model was sure of it, the
      // whole tile otherwise. Cut from the image that was actually sent, so
      // the boxes and the pixels are the same picture.
      setFeed({ at: 'cutting', done: 0, total: detections.length });
      const cut = new Map<string, Harvested>();
      for (let i = 0; i < detections.length; i++) {
        const d = detections[i];
        const shot = shots[d.screenshot - 1];
        if (shot) {
          try {
            const g = d.garment;
            const sure = Boolean(g.box) && g.confidence >= 0.5;
            const px = sure
              ? garmentCropPixels(g.box!, d.tileBox, shot.width, shot.height)
              : tileCropPixels(d.tileBox, shot.width, shot.height);
            let picture = px.w >= 8 && px.h >= 8 ? await cropPixels(shot.dataUrl, px) : '';
            if (!picture) {
              const tile = tileCropPixels(d.tileBox, shot.width, shot.height);
              if (tile.w >= 8 && tile.h >= 8) picture = await cropPixels(shot.dataUrl, tile);
            }
            if (picture) {
              cut.set(d.ref, {
                ref: d.ref,
                crop: picture,
                picture,
                note: d.tileFallback
                  ? 'the tile was placed by grid math — the model could not box it'
                  : undefined,
              });
            }
          } catch {
            // No picture for this row. The piece still arrives; the closet draws it.
          }
        }
        setFeed({ at: 'cutting', done: i + 1, total: detections.length });
      }

      const read: IntakeRead = { drafts: mapped.drafts, skipped, dropped: droppedRows, photos };
      setResult(read);
      setSource(shots.find(Boolean)?.dataUrl ?? null);
      setPictures(cut);
      setEdited({});
      setTried(null);
      setFeedMode(true);
      setGalleryMode(false);
      const dupes = findDuplicates(read.drafts, activeItems);
      setTicked(new Set(read.drafts.filter(d => d.confidence >= 0.55 && !dupes.has(d.ref)).map(d => d.ref)));
      setFeed({ at: 'idle' });
    } catch (e) {
      setFeed({ at: 'idle' });
      setFeedFailure(e instanceof Error ? e.message : 'That did not work. Nothing was changed.');
    }
  };

  /**
   * Read one or more photographs from the gallery, end to end.
   *
   * One journey out PER PHOTOGRAPH, declared on the card before the button.
   * Each photograph gets the single-photo prompt — clothes laid out, hanging,
   * or one outfit as worn; two or more people get an empty answer, by rule.
   * Every piece is cut out and lifted off its background here, on this
   * device, and lands on this same bench as a draft with its provenance —
   * nothing is written until the owner says so.
   */
  const onGallery = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFailure(null);
    setGalFailure(
      files.length > GALLERY_LIMIT ? `Nine at a time — the first ${GALLERY_LIMIT} were taken.` : null
    );

    const images = [...files].slice(0, GALLERY_LIMIT).filter(f => f.type.startsWith('image/'));
    if (!images.length) {
      setGalFailure('None of those files is a photograph. A JPG or PNG works.');
      return;
    }

    const reads: Array<{ n: number; read: IntakeRead }> = [];
    // Indexed by photo number, so a photograph that fails to read can never
    // shift which image a later piece is cut from.
    const shots: Array<Prepared | null> = [];
    const skips: IntakeSkip[] = [];
    const unreadable: string[] = [];

    try {
      setGal({ at: 'reading', done: 0, total: images.length });
      for (let i = 0; i < images.length; i++) {
        const n = i + 1;
        shots.push(null);
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve((e.target?.result as string) ?? '');
            reader.onerror = () => reject(new Error('That photograph would not open.'));
            reader.readAsDataURL(images[i]);
          });
          const image = await prepareImage(dataUrl);
          shots[i] = image;
          const { text: answer } = await readPhotograph(image, buildPhotoPrompt());
          setText(answer);

          const read = readIntake(answer);
          if (read.error) {
            skips.push({ reason: 'That photograph would not read', note: read.error, photo: n });
          } else {
            reads.push({ n, read });
          }
        } catch (e) {
          unreadable.push(e instanceof Error ? e.message : 'That did not work.');
          skips.push({ reason: 'That photograph would not read', photo: n });
        }
        setGal({ at: 'reading', done: n, total: images.length });
      }

      // Every photograph failing the journey is a failure, not an empty bench.
      if (!reads.length) {
        setGal({ at: 'idle' });
        setGalFailure(unreadable[0] ?? 'Nothing wearable in those photographs.');
        return;
      }

      const mapped = galleryDrafts(reads);
      const skipped: IntakeSkip[] = [
        ...skips,
        ...mapped.skipped,
        ...mapped.dupes.map(dupe => ({
          reason: 'Already in this import — not added twice.',
          note: `${dupe.name}, seen again in photo ${dupe.photo}`,
        })),
      ];

      // The crops: cut from the photograph that named the piece, along the
      // model's own box. No background lift here — measured on real gallery
      // photographs (pieces lying on other pieces), the automatic lift ate
      // sleeves and kept neighbours, and its own scoring could not tell. The
      // clean crop is the honest picture; the manual bench in the piece
      // editor still lifts, with a person drawing the box and judging.
      setGal({ at: 'cutting', done: 0, total: mapped.drafts.length });
      const cut = new Map<string, Harvested>();
      for (let i = 0; i < mapped.drafts.length; i++) {
        const d = mapped.drafts[i];
        const shot = shots[(d.photo ?? 1) - 1];
        if (shot && d.box) {
          try {
            const px = photoCropPixels(d.box, shot.width, shot.height);
            const picture = px.w >= 8 && px.h >= 8 ? await cropPixels(shot.dataUrl, px) : '';
            if (picture) {
              cut.set(d.ref, { ref: d.ref, crop: picture, picture });
            }
          } catch {
            // No picture for this row. The piece still arrives; the closet draws it.
          }
        }
        setGal({ at: 'cutting', done: i + 1, total: mapped.drafts.length });
      }

      const read: IntakeRead = {
        drafts: mapped.drafts,
        skipped,
        dropped: mapped.dropped,
        photos: images.map((f, i) => ({ n: i + 1, note: f.name })),
      };
      setResult(read);
      setSource(shots.find(Boolean)?.dataUrl ?? null);
      setPictures(cut);
      setEdited({});
      setTried(null);
      setFeedMode(false);
      setGalleryMode(true);
      const dupes = findDuplicates(read.drafts, activeItems);
      setTicked(new Set(read.drafts.filter(d => d.confidence >= 0.55 && !dupes.has(d.ref)).map(d => d.ref)));
      setGal({ at: 'idle' });
    } catch (e) {
      setGal({ at: 'idle' });
      setGalFailure(e instanceof Error ? e.message : 'That did not work. Nothing was changed.');
    }
  };

  const toggle = (ref: string) =>
    setTicked(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(worn ? OUTFIT_PROMPT : INTAKE_PROMPT);
    } catch {
      // Clipboard permission can be refused; the prompt is still readable in
      // docs/23, so say what happened rather than pretending it worked.
      showToast('Could not reach the clipboard — the prompt is in docs/23.', 'error');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const trySample = async (s: IntakeSample) => {
    const res = await fetch(s.file);
    const raw = await res.text();
    setText(raw);
    setTried(s);
    readFile(raw);
  };

  const view = (d: IntakeDraft): IntakeDraft => ({ ...d, ...edited[d.ref] });

  /**
   * One catalogue at a time.
   *
   * Filing a dozen photographs is seconds of work on a phone, and this button
   * used to write its rows synchronously — there was no window for a second
   * press. There is now, and a second press inside it would catalogue the whole
   * bench twice. A ref, because guarding a write should not cost a render.
   */
  const cataloguing = useRef(false);

  const commit = async () => {
    if (!result) return;
    if (cataloguing.current) return;
    cataloguing.current = true;
    try {
      await writeChosen(result);
    } finally {
      cataloguing.current = false;
    }
  };

  const writeChosen = async (result: IntakeRead) => {
    const chosen = result.drafts.filter(d => ticked.has(d.ref)).map(view);

    /*
     * FILE THE PICTURES FIRST, THEN WRITE THE ROWS.
     *
     * This is the heaviest write in the app — a dozen pieces at a hundred
     * kilobytes apiece is where a device runs out of purse — so every picture
     * goes to the photograph store before a single row is composed.
     *
     * Two separate passes rather than one interleaved loop, and the reason is
     * React rather than storage: the addItem loop below lands inside one
     * render, and putting an `await` between its iterations would break it
     * into a dozen. So the awaiting happens here, once, and the loop that
     * follows is exactly the loop that was always there.
     *
     * storePhoto never throws and never blocks a piece: when references are
     * off, or the browser will not open the database, it hands the data URL
     * straight back and the row keeps its picture inline as before.
     */
    const filed = new Map<string, string>();
    for (const d of chosen) {
      filed.set(d.ref, await storePhoto(pictures.get(d.ref)?.picture ?? ''));
    }
    // The mirror shot is one photograph for the whole look, and it is the
    // biggest single picture this page can write, so it is filed too.
    const lookPicture = source ? await storePhoto(source) : undefined;

    const written: string[] = [];
    for (const d of chosen) {
      written.push(addItem({
        ...draftToItem(d),
        // The picture cut from the photograph, when there is one.
        imageUrl: filed.get(d.ref) ?? '',
        favorite: false,
      }));
    }

    // A worn photograph is a look as well as a row of pieces. Saving it as one
    // is offered, never assumed — some days are just a record of clothes.
    const look = result.outfit;
    if (look && saveLook && written.length > 1) {
      addOutfit({
        name: look.name,
        itemIds: written,
        occasion: look.occasion[0],
        favorite: false,
        // The mirror shot itself, kept as the look's own picture.
        imageUrl: lookPicture,
        notes: 'Read from a photograph.',
      });
    }

    /*
     * PHOTOGRAPHED WEARING THEM, THEN FILED AT NEVER WORN.
     *
     * The worn flow's entire premise is that these are on your body right now,
     * and the record used to open by contradicting it: every piece the model
     * had just seen you in read NEVER WORN, with no last-worn date and no
     * cost per wear, and the only way out was opening four to six pieces and
     * logging each by hand. One call fixes it, and the tick above means the
     * wear is offered rather than assumed — nothing here is written unsaid.
     */
    const logged = wornRead && logToday && written.length > 0;
    if (logged) logWear(written);

    /*
     * The news waits for the device. A coalesced write lands a beat after the
     * button, so "Catalogued." used to be printed before the disk had been
     * asked — and on a full device it stood directly above the refusal, with
     * sixty pieces living only in memory until the next refresh threw them
     * away. If the write was refused, the truthful line is the only one said.
     */
    confirmWrite(
      () => showToast(
        logged
          ? `Catalogued. ${chosen.length} ${chosen.length === 1 ? 'piece is' : 'pieces are'} on record, worn today.`
          : `Catalogued. ${chosen.length} ${chosen.length === 1 ? 'piece is' : 'pieces are'} on record.`,
        'seal'
      ),
      () => showToast(
        'Not written — this device has no room left. Export a backup from Settings, then keep fewer photographs.',
        'error'
      ),
    );
    navigate('/closet');
  };

  const drafts = result?.drafts ?? [];
  const chosenCount = drafts.filter(d => ticked.has(d.ref)).length;

  /**
   * The wear the worn flow is evidence of, offered rather than assumed.
   *
   * Written once and shown wherever the bench has room for it — beside the
   * outfit tick when a photograph is on screen, on its own above the commit
   * row when the read came from pasted text. It has to be VISIBLE on every
   * road that can log it: a wear written without being offered is a wear
   * written unsaid, which is the one thing this bench does not do.
   */
  const wearTick = wornRead && drafts.length > 0 ? (
    <label className="flex items-center gap-2.5 min-h-11 cursor-pointer">
      <input
        type="checkbox"
        checked={logToday}
        onChange={e => setLogToday(e.target.checked)}
        className="w-4 h-4 accent-[var(--color-accent)]"
      />
      <span className="text-[14px] text-text-2">
        Log today&rsquo;s wear for these pieces
      </span>
    </label>
  ) : null;

  return (
    <div className="space-y-6">
      <Masthead
        title="Catalogue from photos"
        meta={result && !result.error ? `${drafts.length} found` : undefined}
        // Reached from inside the Closet and in no nav list, so without this the
        // only exit is the browser's own back button — which a person running
        // this from their home screen does not have.
        action={<LinkButton to="/closet" compact icon={<IconChevronLeft size={16} />}>Closet</LinkButton>}
      />

      {!result || result.error ? (
        <div className="space-y-5">
          <div className="bg-surface plate p-5 rounded-[2px]">
            <p className="type-editorial text-[20px] leading-snug text-balance">
              {worn
                ? 'Photograph what you are wearing, and let it come apart into its pieces.'
                : 'Lay the clothes out, photograph them, and let a model do the typing.'}
            </p>
            <p className="text-[14px] text-text-2 mt-3 leading-relaxed">
              {worn
                ? 'A mirror shot is enough. Each piece is found, cut out of the photograph on this device, and arrives as a draft to check — the shirt, not the shoulders it is on.'
                : 'Every piece is found, cut out of the photograph on this device, and arrives as a draft to check. Nothing is written until you say so.'}
            </p>

            <Basting className="my-5" />

            {/* The one thing in Almari that leaves the device, said before the
                button that does it — never after, and never in a tooltip. */}
            <div className="rounded-[2px] border border-accent/60 bg-sunken p-4">
              <p className="type-ledger text-[11px] text-accent">This one step uses the network</p>
              <p className="text-[13px] text-text-2 mt-2 leading-relaxed">
                The photograph goes to Claude Fable by Anthropic, through Almari&rsquo;s relay, which
                holds the key on the server so this device never has one — or to your own
                endpoint, if you have set one in Settings. It comes back as words and
                coordinates. The cutting, the background removal and the writing all happen
                on this device, and the photograph makes exactly one journey.
              </p>
              <p className="type-ledger text-[10px] text-text-2 mt-3">
                No key on this device · your own endpoint can be set in Settings
              </p>
            </div>

            <input
              ref={photoRef}
              id="intake-photo"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={e => { void onPhoto(e.target.files?.[0]); if (e.target) e.target.value = ''; }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json,text/plain"
              className="sr-only"
              onChange={e => onFile(e.target.files?.[0])}
            />

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button
                tone="primary"
                icon={<IconCamera size={16} />}
                disabled={working.at !== 'idle' || feed.at !== 'idle' || gal.at !== 'idle'}
                onClick={() => photoRef.current?.click()}
              >
                {working.at === 'sending'
                  ? 'Reading the photograph…'
                  : working.at === 'cutting'
                    ? `Cutting ${working.done} of ${working.total}…`
                    : worn ? 'Read what I am wearing' : 'Read a photograph'}
              </Button>
              {working.at !== 'idle' ? (
                <span className="type-ledger text-[10px] text-text-2">
                  {working.at === 'sending' ? 'One journey out, then everything else is local' : 'On this device'}
                </span>
              ) : null}
            </div>

            {failure ? (
              <p className="text-[13px] text-danger mt-3 leading-snug">{failure}</p>
            ) : null}

            <Basting className="my-5" />

            {/* Still here, and deliberately: no key, another model you prefer,
                or simply no wish to send a photograph anywhere. */}
            <p className="type-ledger text-[11px] text-text-2">Or do it yourself</p>
            <p className="text-[13px] text-text-2 mt-2 leading-relaxed">
              Take the prompt to whatever model you already use, and bring the file back. Nothing
              here touches the network at all.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Button compact icon={<IconCopy size={16} />} onClick={copyPrompt}>
                {copied ? 'Prompt copied' : 'Copy the prompt'}
              </Button>
              <Button compact icon={<IconImport size={16} />} onClick={() => fileRef.current?.click()}>
                Choose the file
              </Button>
              <span className="type-ledger text-[11px] text-text-2">or paste it below</span>
            </div>
          </div>

          {/* ---- from a feed screenshot ----
               A whole grid at once: the tiles are located, the solo ones read,
               the group ones left alone. Same bench, same last word. */}
          <div className="bg-surface plate p-5 rounded-[2px]" ref={feedCardRef}>
            <p className="type-ledger text-[11px] text-text-2">From a feed screenshot</p>
            <p className="text-[14px] text-text-2 mt-2 leading-relaxed">
              A screenshot of an Instagram grid holds a row of posts at once. Each tile is read
              on its own: a solo shot comes apart into its pieces; a group photo is left alone.
              Every piece arrives here as a draft, cut out on this device.
            </p>
            <div className="rounded-[2px] border border-accent/60 bg-sunken p-4 mt-4">
              <p className="type-ledger text-[11px] text-accent">One journey per screenshot</p>
              <p className="text-[13px] text-text-2 mt-2 leading-relaxed">
                The screenshots go to Claude Fable by Anthropic, through Almari&rsquo;s relay — the
                key is held on the server, never on this device — only when you press the button.
                Group photos are left alone, and nothing is written until you say so.
              </p>
            </div>
            <input
              ref={feedRef}
              id="intake-feed"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={e => { void onFeed(e.target.files); if (e.target) e.target.value = ''; }}
            />
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button
                icon={<IconFeed size={16} />}
                disabled={feed.at !== 'idle' || working.at !== 'idle' || gal.at !== 'idle'}
                onClick={() => feedRef.current?.click()}
              >
                {feed.at === 'reading'
                  ? `Reading screenshot ${feed.done + 1} of ${feed.total}…`
                  : feed.at === 'cutting'
                    ? `Cutting ${feed.done} of ${feed.total}…`
                    : 'Read a feed screenshot'}
              </Button>
              <span className="type-ledger text-[10px] text-text-2">
                {feed.at === 'idle'
                  ? `up to ${FEED_LIMIT} at a time`
                  : 'One journey out each, then everything else is local'}
              </span>
            </div>
            {feedFailure ? (
              <p className="text-[13px] text-danger mt-3 leading-snug">{feedFailure}</p>
            ) : null}
          </div>

          {/* ---- from your photos ----
               The owner's own gallery: many photographs at once, one read
               each. Same bench, same last word. */}
          <div className="bg-surface plate p-5 rounded-[2px]" ref={galleryCardRef}>
            <p className="type-ledger text-[11px] text-text-2">From your photos</p>
            <p className="text-[14px] text-text-2 mt-2 leading-relaxed">
              Choose a handful of photographs — flat lays, hanger shots, one outfit as worn.
              Each is read on its own; every piece found is cut out of its photograph on this
              device, and arrives here as a draft to check. A photograph of two or more people
              gets an empty answer, by rule.
            </p>
            <div className="rounded-[2px] border border-accent/60 bg-sunken p-4 mt-4">
              <p className="type-ledger text-[11px] text-accent">One journey per photograph</p>
              <p className="text-[13px] text-text-2 mt-2 leading-relaxed">
                The photographs go to Claude Fable by Anthropic, through Almari&rsquo;s relay — the
                key is held on the server, never on this device — only when you press the
                button. Nothing is written until you say so.
              </p>
            </div>
            <input
              ref={galleryRef}
              id="intake-gallery"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={e => { void onGallery(e.target.files); if (e.target) e.target.value = ''; }}
            />
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button
                icon={<IconCamera size={16} />}
                disabled={gal.at !== 'idle' || working.at !== 'idle' || feed.at !== 'idle'}
                onClick={() => galleryRef.current?.click()}
              >
                {gal.at === 'reading'
                  ? `Reading photo ${gal.done + 1} of ${gal.total}…`
                  : gal.at === 'cutting'
                    ? `Cutting ${gal.done} of ${gal.total}…`
                    : 'Read your photos'}
              </Button>
              <span className="type-ledger text-[10px] text-text-2">
                {gal.at === 'idle'
                  ? `up to ${GALLERY_LIMIT} at a time`
                  : 'One journey out each, then everything else is local'}
              </span>
            </div>
            {galFailure ? (
              <p className="text-[13px] text-danger mt-3 leading-snug">{galFailure}</p>
            ) : null}
          </div>

          <div className="bg-surface plate p-5 rounded-[2px]">
            <label htmlFor="intake-paste" className="type-ledger text-[11px] text-text-2">
              The file
            </label>
            <textarea
              id="intake-paste"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder={'{\n  "pieces": [ … ]\n}'}
              className="w-full mt-2 bg-sunken border border-border rounded-[2px] p-3 text-base lg:text-[12px] text-text resize-none font-mono normal-case tracking-normal"
            />
            {result?.error ? (
              <p className="text-[13px] text-danger mt-3">{result.error}</p>
            ) : null}
            <div className="mt-4">
              <Button tone="primary" disabled={!text.trim()} onClick={() => readFile(text)}>
                Read it
              </Button>
            </div>
          </div>

          {/* ---- the sample bench ----
               Six photographs and the file the prompt actually returned for
               each. Two hold no clothes at all: the point of showing them is
               that the answer "nothing here" is a real answer, and you can
               watch this prompt give it. */}
          <div className="bg-surface plate p-5 rounded-[2px]">
            <p className="type-ledger text-[11px] text-text-2">Try it on a photograph</p>
            <p className="text-[14px] text-text-2 mt-2 leading-relaxed">
              Six real photographs, and the honest file each one produced. Open
              any of them to see what the model found — and what it refused to
              name.
            </p>
            <Basting className="my-4" />
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INTAKE_SAMPLES.map(s => (
                <li key={s.slug}>
                  <button
                    type="button"
                    onClick={() => trySample(s)}
                    className="block w-full text-left group"
                  >
                    <span className="block bg-mat overflow-hidden rounded-[2px] border border-border group-hover:border-text transition-colors duration-150 relative" style={{ aspectRatio: '4 / 3' }}>
                      {s.photo ? (
                        <img src={s.photo} alt={s.caption} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 text-text-2">
                          <PlateEmptyCloset />
                          <span className="type-ledger text-[10px] mt-1 leading-relaxed">{s.photoNote}</span>
                        </span>
                      )}
                    </span>
                    <span className="block text-[15px] text-text mt-2 group-hover:underline underline-offset-[3px]">
                      {s.title}
                    </span>
                    <span className="block text-[13px] text-text-2 mt-1 leading-snug">{s.caption}</span>
                    <span className="type-ledger text-[10px] text-text-2 block mt-1.5 tabular">
                      {s.outcome}
                      {s.credit ? ` · ${s.credit}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : drafts.length === 0 ? (
        <div className="space-y-5">
          {tried ? (
            <div className="bg-surface plate p-4 rounded-[2px] flex items-center gap-4">
              {tried.photo ? (
                <span className="w-28 shrink-0 bg-mat overflow-hidden rounded-[2px] border border-border" style={{ aspectRatio: '4 / 3' }}>
                  <img src={tried.photo} alt={tried.caption} className="w-full h-full object-cover" />
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="block text-[15px] text-text">{tried.title}</span>
                <span className="block text-[13px] text-text-2 mt-0.5 leading-snug">{tried.caption}</span>
              </span>
            </div>
          ) : null}
          <EmptyState
            plate={<PlateEmptyCloset />}
            title={feedMode ? 'Nothing wearable in those screenshots.' : galleryMode ? 'Nothing wearable in those photographs.' : 'Nothing wearable in that photograph.'}
            body="The model was asked to say so rather than guess. What it looked at, and why it left each thing alone, is below."
            action={<Button onClick={() => { setResult(null); setText(''); setTried(null); setFeedMode(false); setFeedFailure(null); setGalleryMode(false); setGalFailure(null); setPictures(new Map()); setSource(null); }}>Try another</Button>}
          />
          {result.skipped.length ? (
            <div className="bg-surface plate p-4 rounded-[2px]">
              <p className="type-ledger text-[11px] text-text-2">What it left alone</p>
              <Basting className="my-3" />
              <ul className="space-y-1.5">
                {result.skipped.map((s, i) => (
                  <li key={i} className="text-[13px] text-text-2 leading-snug">
                    {s.photo !== undefined ? <span>{feedMode ? 'screenshot' : 'photo'} {s.photo} — </span> : null}
                    {s.reason}{s.note ? <span> — {s.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {tried ? (
            <div className="bg-surface plate p-4 rounded-[2px] flex items-center gap-4">
              {tried.photo ? (
                <span className="w-24 shrink-0 bg-mat overflow-hidden rounded-[2px] border border-border" style={{ aspectRatio: '4 / 3' }}>
                  <img src={tried.photo} alt={tried.caption} className="w-full h-full object-cover" />
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="block text-[15px] text-text">{tried.title}</span>
                <span className="block text-[13px] text-text-2 mt-0.5 leading-snug">{tried.caption}</span>
              </span>
            </div>
          ) : null}
          {/* What was read, and what it became. */}
          {source ? (
            <div className="bg-surface plate p-4 rounded-[2px] flex flex-wrap items-start gap-4">
              <span className="w-24 shrink-0 bg-mat overflow-hidden rounded-[2px] border border-border" style={{ aspectRatio: '3 / 4' }}>
                <img src={source} alt="The photograph that was read" className="w-full h-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-text">
                  {result.outfit ? result.outfit.name : feedMode ? 'These screenshots' : galleryMode ? 'These photographs' : 'This photograph'}
                </p>
                <p className="text-[13px] text-text-2 mt-1 leading-snug">
                  {drafts.length} {drafts.length === 1 ? 'piece' : 'pieces'} found and cut out on this
                  device. {feedMode ? 'The screenshots themselves stay here.' : galleryMode ? 'The photographs themselves stay here.' : 'The photograph itself stays here.'}
                </p>
                {(result.outfit && drafts.length > 1) || wearTick ? (
                  <div className="mt-2">
                    {result.outfit && drafts.length > 1 ? (
                      <label className="flex items-center gap-2.5 min-h-11 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveLook}
                          onChange={e => setSaveLook(e.target.checked)}
                          className="w-4 h-4 accent-[var(--color-accent)]"
                        />
                        <span className="text-[14px] text-text-2">
                          Keep these together as an outfit, &ldquo;{result.outfit.name}&rdquo;
                        </span>
                      </label>
                    ) : null}
                    {wearTick}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="bg-surface plate p-4 rounded-[2px] flex flex-wrap items-center gap-3">
            <p className="text-[14px] text-text-2 flex-1 min-w-[200px]">
              Every piece below is a draft. Untick anything the model got wrong —
              nothing is written until you say so.
            </p>
            <span className="type-ledger text-[11px] text-text-2 tabular">
              {chosenCount} of {drafts.length} ticked
            </span>
          </div>

          <ul className="space-y-3">
            {drafts.map(raw => {
              const d = view(raw);
              const on = ticked.has(d.ref);
              const dupe = duplicates.has(d.ref);
              return (
                <li key={d.ref} className={`bg-surface plate rounded-[2px] ${on ? '' : 'opacity-60'}`}>
                  <div className="flex gap-3 p-4 pt-5">
                    <button
                      type="button"
                      onClick={() => toggle(d.ref)}
                      aria-pressed={on}
                      aria-label={on ? `Leave out ${d.name}` : `Take in ${d.name}`}
                      className={`w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-[2px] border ${
                        on ? 'bg-ink text-on-ink border-transparent' : 'border-border text-text-2'
                      }`}
                    >
                      {on ? <IconCheck size={18} /> : <IconClose size={16} />}
                    </button>

                    {/* The piece as it was actually cut out of the photograph,
                        or the drawn flat when no picture could be made. The
                        flat is a finished state here too, not a gap. */}
                    <span className="w-14 h-[70px] shrink-0 bg-mat overflow-hidden rounded-[2px]">
                      {pictures.get(d.ref) ? (
                        <img
                          src={pictures.get(d.ref)!.picture}
                          alt={d.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <GarmentPlate categoryId={d.category} color={d.color} name={d.name} />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[16px] text-text leading-snug">{d.name}</p>
                        <span className="type-ledger text-[10px] text-text-2 shrink-0 tabular mr-6">
                          {confidenceWord(d.confidence)}
                        </span>
                      </div>
                      {d.description ? (
                        <p className="text-[13px] text-text-2 mt-1 leading-snug">{d.description}</p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <Chip as="span">{categoryLabel(settings, d.category)}</Chip>
                        <span
                          className="w-5 h-5 rounded-[2px] border border-border shrink-0"
                          style={{ background: d.color }}
                          title={d.color}
                        />
                        {/* The colour is the field a model misreads most, so it
                            is correctable right here, in the house palette. */}
                        <select
                          aria-label={`Colour for ${d.name}`}
                          value={PRESET_COLORS.includes(d.color) ? d.color : ''}
                          onChange={e => {
                            if (!e.target.value) return;
                            setEdited(p => ({ ...p, [d.ref]: { ...p[d.ref], color: e.target.value } }));
                          }}
                          className="h-11 px-1 bg-sunken border border-border rounded-[2px] type-ledger text-base lg:text-[11px] text-text"
                        >
                          {!PRESET_COLORS.includes(d.color) ? <option value="">{d.color}</option> : null}
                          {PRESET_COLORS.map(hex => (
                            <option key={hex} value={hex}>{hex}</option>
                          ))}
                        </select>
                        {d.season.length && d.season.length < 4 ? (
                          <span className="type-ledger text-[10px] text-text-2">
                            {d.season.map(s => SEASON_LABELS[s]).join(' · ')}
                          </span>
                        ) : null}
                        {d.occasion.length ? (
                          <span className="type-ledger text-[10px] text-text-2">
                            {d.occasion.map(displayTag).join(' · ')}
                          </span>
                        ) : null}
                      </div>

                      {(d.uncertain.length > 0 || d.repairs.length > 0 || dupe
                        || pictures.get(d.ref)?.note
                        || (d.seen !== undefined && d.seen < 0.4)) ? (
                        <p className="type-ledger text-[10px] text-text-2 mt-2 leading-relaxed">
                          {dupe ? 'A piece with this name is already in the closet. ' : ''}
                          {d.seen !== undefined && d.seen < 0.4
                            ? 'Mostly hidden in the photograph. '
                            : ''}
                          {d.uncertain.length ? `Guessed: ${d.uncertain.join(', ')}. ` : ''}
                          {d.repairs.join(' ')}
                          {pictures.get(d.ref)?.note ? ` ${pictures.get(d.ref)!.note}.` : ''}
                        </p>
                      ) : null}

                      {/* The two fields most worth correcting, corrected here. */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <input
                          aria-label={`Name for ${d.name}`}
                          value={d.name}
                          onChange={e => setEdited(p => ({ ...p, [d.ref]: { ...p[d.ref], name: e.target.value } }))}
                          className="flex-1 min-w-[140px] h-11 px-2 bg-sunken border border-border rounded-[2px] text-base lg:text-[14px] text-text"
                        />
                        <select
                          aria-label={`Category for ${d.name}`}
                          value={d.category}
                          onChange={e =>
                            setEdited(p => ({ ...p, [d.ref]: { ...p[d.ref], category: e.target.value as CategoryId } }))
                          }
                          // 16px below lg here too — iOS zooms a focused select
                          // exactly like a text field, and never zooms back.
                          className="h-11 px-2 bg-sunken border border-border rounded-[2px] type-ledger text-base lg:text-[11px] text-text"
                        >
                          {settings.categories.map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {result.skipped.length > 0 ? (
            <div className="bg-surface plate p-4 rounded-[2px]">
              <p className="type-ledger text-[11px] text-text-2">What the model left out</p>
              <Basting className="my-3" />
              <ul className="space-y-1.5">
                {result.skipped.map((s, i) => (
                  <li key={i} className="text-[13px] text-text-2 leading-snug">
                    {s.photo !== undefined ? <span>{feedMode ? 'screenshot' : 'photo'} {s.photo} — </span> : null}
                    {s.reason}
                    {s.note ? <span className="text-text-2"> — {s.note}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.dropped.length > 0 ? (
            <p className="type-ledger text-[11px] text-text-2">
              {result.dropped.length} {result.dropped.length === 1 ? 'row was' : 'rows were'} unusable and left out.
            </p>
          ) : null}

          {/* No photograph on the bench means no card to hang it from, and the
              tick may not go missing just because the read was pasted. */}
          {!source && wearTick ? (
            <div className="bg-surface plate p-4 rounded-[2px]">{wearTick}</div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button tone="hero" disabled={chosenCount === 0} onClick={commit}>
              {chosenCount === 1 ? 'Add 1 piece to the closet' : `Add ${chosenCount} pieces to the closet`}
            </Button>
            <Button onClick={() => { setResult(null); setText(''); setTried(null); setFeedMode(false); setFeedFailure(null); setGalleryMode(false); setGalFailure(null); setPictures(new Map()); setSource(null); }}>Start over</Button>
          </div>
        </div>
      )}
    </div>
  );
}
