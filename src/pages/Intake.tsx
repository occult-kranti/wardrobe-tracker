import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { showToast } from '../components/Toast';
import { Button, Chip, Masthead, EmptyState } from '../components/ui';
import { Basting, GarmentPlate, PlateEmptyCloset } from '../components/art';
import { IconCheck, IconClose, IconImport, IconCopy } from '../components/icons';
import { categoryLabel, SEASON_LABELS, type CategoryId } from '../types';
import {
  readIntake, draftToItem, findDuplicates,
  type IntakeDraft, type IntakeRead,
} from '../lib/intake';
import { INTAKE_PROMPT } from '../lib/intakePrompt';
import { INTAKE_SAMPLES, type IntakeSample } from '../lib/intakeSamples';

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

export default function Intake() {
  const { addItem, activeItems, settings } = useWardrobe();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [result, setResult] = useState<IntakeRead | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, Partial<IntakeDraft>>>({});
  const [copied, setCopied] = useState(false);
  const [tried, setTried] = useState<IntakeSample | null>(null);

  const duplicates = useMemo(
    () => (result ? findDuplicates(result.drafts, activeItems) : new Set<string>()),
    [result, activeItems]
  );

  const readFile = (raw: string) => {
    const r = readIntake(raw);
    setResult(r);
    setEdited({});
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

  const toggle = (ref: string) =>
    setTicked(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(INTAKE_PROMPT);
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

  const commit = () => {
    if (!result) return;
    const chosen = result.drafts.filter(d => ticked.has(d.ref)).map(view);
    for (const d of chosen) addItem({ ...draftToItem(d), favorite: false });
    showToast(
      `Catalogued. ${chosen.length} ${chosen.length === 1 ? 'piece is' : 'pieces are'} on record.`,
      'seal'
    );
    navigate('/closet');
  };

  const drafts = result?.drafts ?? [];
  const chosenCount = drafts.filter(d => ticked.has(d.ref)).length;

  return (
    <div className="space-y-6">
      <Masthead
        title="Catalogue from photos"
        meta={result && !result.error ? `${drafts.length} found` : undefined}
      />

      {!result || result.error ? (
        <div className="space-y-5">
          <div className="bg-surface plate p-5 rounded-[2px]">
            <p className="type-editorial text-[20px] leading-snug text-balance">
              Lay the clothes out, photograph them, and let a model do the typing.
            </p>
            <p className="text-[14px] text-text-2 mt-3 leading-relaxed">
              The prompt lives in <span className="type-ledger text-[11px]">docs/23-photo-intake.md</span>.
              Paste it into whatever vision model you already use, attach your
              photographs, and drop the file it returns here. The photograph
              never passes through us — we only read the file.
            </p>
            <Basting className="my-5" />
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json,text/plain"
                className="sr-only"
                onChange={e => onFile(e.target.files?.[0])}
              />
              <Button icon={<IconCopy size={16} />} onClick={copyPrompt}>
                {copied ? 'Prompt copied' : 'Copy the prompt'}
              </Button>
              <Button tone="primary" icon={<IconImport size={16} />} onClick={() => fileRef.current?.click()}>
                Choose the file
              </Button>
              <span className="type-ledger text-[11px] text-text-2">or paste it below</span>
            </div>
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
              placeholder={'{\n  "toileIntake": 1,\n  "pieces": [ … ]\n}'}
              className="w-full mt-2 bg-sunken border border-border rounded-[2px] p-3 text-[12px] text-text resize-none font-mono normal-case tracking-normal"
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
            title="Nothing wearable in that photograph."
            body="The model was asked to say so rather than guess. What it looked at, and why it left each thing alone, is below."
            action={<Button onClick={() => { setResult(null); setText(''); setTried(null); }}>Try another</Button>}
          />
          {result.skipped.length ? (
            <div className="bg-surface plate p-4 rounded-[2px]">
              <p className="type-ledger text-[11px] text-text-2">What it left alone</p>
              <Basting className="my-3" />
              <ul className="space-y-1.5">
                {result.skipped.map((s, i) => (
                  <li key={i} className="text-[13px] text-text-2 leading-snug">
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

                    <span className="w-14 h-[70px] shrink-0 bg-mat overflow-hidden rounded-[2px]">
                      <GarmentPlate categoryId={d.category} color={d.color} name={d.name} />
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
                        {d.season.length && d.season.length < 4 ? (
                          <span className="type-ledger text-[10px] text-text-2">
                            {d.season.map(s => SEASON_LABELS[s]).join(' · ')}
                          </span>
                        ) : null}
                      </div>

                      {(d.uncertain.length > 0 || d.repairs.length > 0 || dupe) ? (
                        <p className="type-ledger text-[10px] text-text-2 mt-2 leading-relaxed">
                          {dupe ? 'A piece with this name is already in the closet. ' : ''}
                          {d.uncertain.length ? `Guessed: ${d.uncertain.join(', ')}. ` : ''}
                          {d.repairs.join(' ')}
                        </p>
                      ) : null}

                      {/* The two fields most worth correcting, corrected here. */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <input
                          aria-label={`Name for ${d.name}`}
                          value={d.name}
                          onChange={e => setEdited(p => ({ ...p, [d.ref]: { ...p[d.ref], name: e.target.value } }))}
                          className="flex-1 min-w-[140px] h-11 px-2 bg-sunken border border-border rounded-[2px] text-[14px] text-text"
                        />
                        <select
                          aria-label={`Category for ${d.name}`}
                          value={d.category}
                          onChange={e =>
                            setEdited(p => ({ ...p, [d.ref]: { ...p[d.ref], category: e.target.value as CategoryId } }))
                          }
                          className="h-11 px-2 bg-sunken border border-border rounded-[2px] type-ledger text-[11px] text-text"
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

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button tone="hero" disabled={chosenCount === 0} onClick={commit}>
              {chosenCount === 1 ? 'Add 1 piece to the closet' : `Add ${chosenCount} pieces to the closet`}
            </Button>
            <Button onClick={() => { setResult(null); setText(''); setTried(null); }}>Start over</Button>
          </div>
        </div>
      )}
    </div>
  );
}
