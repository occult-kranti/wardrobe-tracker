import { useEffect, useRef, useState } from 'react';
import { Button, Card, Field, SectionTitle, TableRail, inputClass } from '../components/ui';
import { MODEL_CATALOG, type ModelId } from './lib/modelCatalog';
import { normalizeUsage, estimateModelCost } from './lib/modelCost';
import { runModel, ModelRunError, type ModelRunResult } from './lib/workbenchClient';
import {
  EVENT_EXAMPLE, analyseWorkbenchResult, cropBenchPieces, prepareBenchImage, workbenchPreset,
  type BenchAnalysis, type BenchImage, type WorkbenchMode,
} from './lib/workbenchCases';
import type { ClothingItem } from '@almari/shared/types';

interface RunSnapshot {
  mode: WorkbenchMode;
  system: string;
  prompt: string;
  items: ClothingItem[];
  models: ModelId[];
  maxTokens: number;
  image?: BenchImage;
  capturedAt: string;
}
interface RunRow {
  modelId: ModelId;
  status: 'queued' | 'running' | 'ok' | 'failed' | 'cancelled' | 'not-run';
  result?: ModelRunResult;
  usage?: ReturnType<typeof normalizeUsage>;
  cost?: ReturnType<typeof estimateModelCost>;
  analysis?: BenchAnalysis;
  error?: string;
  note: string;
}
const modes: Array<{ id: WorkbenchMode; label: string }> = [
  { id: 'flatlay', label: 'Flat-lay catalogue' }, { id: 'worn', label: 'Worn outfit catalogue' },
  { id: 'event', label: 'Event styling' }, { id: 'custom', label: 'Custom prompt' },
];
const labelFor = (id: ModelId) => MODEL_CATALOG.find(model => model.id === id)?.label ?? id;
const number = (value: number | null | undefined) => value === null || value === undefined ? 'Not returned' : value.toLocaleString();

/** In-memory test material, deliberately independent of every consumer store. */
export default function Workbench({ token, onRunningChange }: { token: string; onRunningChange: (running: boolean) => void }) {
  const preset = workbenchPreset('flatlay');
  const [mode, setMode] = useState<WorkbenchMode>('flatlay');
  const [system, setSystem] = useState(preset.system);
  const [prompt, setPrompt] = useState(preset.prompt);
  const [eventJson, setEventJson] = useState(EVENT_EXAMPLE);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [eventDirty, setEventDirty] = useState(false);
  const [image, setImage] = useState<BenchImage | null>(null);
  const [models, setModels] = useState<ModelId[]>([MODEL_CATALOG[0].id]);
  const [maxTokens, setMaxTokens] = useState(16000);
  const [preparing, setPreparing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [rows, setRows] = useState<RunRow[]>([]);
  const [includeImages, setIncludeImages] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const imageGeneration = useRef(0);
  const fileInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    onRunningChange(running || preparing);
    return () => onRunningChange(false);
  }, [running, preparing, onRunningChange]);
  useEffect(() => () => { generation.current++; imageGeneration.current++; controller.current?.abort(); }, []);

  const applyPreset = (next: WorkbenchMode = mode) => {
    try {
      const selected = workbenchPreset(next, eventJson);
      setMode(next); setSystem(selected.system); setPrompt(selected.prompt); setItems(selected.items); setEventDirty(false); setError('');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'The test case could not be read.'); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    const current = ++imageGeneration.current;
    setPreparing(true); setError(''); setImage(null);
    try {
      const prepared = await prepareBenchImage(file);
      if (imageGeneration.current === current) setImage(prepared);
    } catch (problem) {
      if (imageGeneration.current === current) setError(problem instanceof Error ? problem.message : 'The image could not be prepared.');
    } finally { if (imageGeneration.current === current) setPreparing(false); }
  };
  const clear = () => {
    generation.current++; imageGeneration.current++; controller.current?.abort(); controller.current = null;
    setRunning(false); setPreparing(false); setImage(null); setRows([]); setSnapshot(null); setIncludeImages(false); setError('');
    setEventJson(EVENT_EXAMPLE); setEventDirty(false); setItems([]); setMode('flatlay'); setSystem(preset.system); setPrompt(preset.prompt);
    if (fileInput.current) fileInput.current.value = '';
  };
  const run = async () => {
    if (running || preparing || !token.trim() || !prompt.trim() || eventDirty || models.length === 0 || models.length > 4) return;
    if ((mode === 'flatlay' || mode === 'worn') && !image) return;
    if (!Number.isInteger(maxTokens) || maxTokens < 512 || maxTokens > 16000) { setError('Use a whole token limit between 512 and 16000.'); return; }
    const request: RunSnapshot = {
      mode, system, prompt, items: structuredClone(items), models: [...models], maxTokens,
      ...(mode !== 'event' && image ? { image } : {}), capturedAt: new Date().toISOString(),
    };
    const current = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    setSnapshot(request); setRows(request.models.map(modelId => ({ modelId, status: 'queued', note: '' }))); setRunning(true); setError('');
    const update = (id: ModelId, changes: Partial<RunRow>) => {
      if (generation.current === current) setRows(previous => previous.map(row => row.modelId === id ? { ...row, ...changes } : row));
    };
    try {
      for (const modelId of request.models) {
        if (abort.signal.aborted || generation.current !== current) break;
        update(modelId, { status: 'running' });
        try {
          const result = await runModel({
            modelId, token, system: request.system, prompt: request.prompt, maxTokens: request.maxTokens,
            ...(request.image ? { image: { mimeType: request.image.mimeType, base64: request.image.base64 } } : {}), signal: abort.signal,
          });
          if (generation.current !== current) break;
          const usage = normalizeUsage(modelId, result.raw);
          const cost = estimateModelCost(modelId, usage, result.requestedAt);
          // A received response is a completed, potentially billable call even
          // if local validation fails or cancellation arrives during cropping.
          update(modelId, { status: 'ok', result, usage, cost });
          if (abort.signal.aborted) break;
          let analysis: BenchAnalysis;
          try { analysis = analyseWorkbenchResult(request.mode, result.text, request.items); }
          catch { analysis = { status: 'invalid', summary: 'Local validation could not read this answer.', issues: ['The complete response and its usage are retained for review.'], pieces: [] }; }
          if (request.image && analysis.pieces.length) {
            try { analysis = { ...analysis, pieces: await cropBenchPieces(request.image, analysis.pieces) }; }
            catch { analysis = { ...analysis, issues: [...analysis.issues, 'Local crop preview could not be prepared; the model answer is retained.'] }; }
          }
          if (abort.signal.aborted || generation.current !== current) break;
          update(modelId, { status: 'ok', result, usage, cost, analysis });
        } catch (problem) {
          const cancelled = abort.signal.aborted || (problem instanceof Error && problem.name === 'AbortError');
          update(modelId, { status: cancelled ? 'cancelled' : 'failed', error: cancelled
            ? 'Stopped waiting. The provider may still charge for the submitted call.'
            : problem instanceof Error ? problem.message : 'The test failed. Cost is unavailable.' });
          if (cancelled || (problem instanceof ModelRunError && (problem.status === 401 || problem.status === 403))) break;
        }
      }
    } finally {
      if (generation.current === current) {
        setRows(previous => previous.map(row => row.status === 'queued' ? { ...row, status: 'not-run' }
          : row.status === 'running' ? { ...row, status: 'cancelled', error: 'Stopped waiting. Cost is unavailable; the provider may still charge.' } : row));
        setRunning(false); controller.current = null;
      }
    }
  };
  const exportResults = () => {
    if (!snapshot || !rows.length) return;
    const { image: sentImage, items: _items, ...input } = snapshot;
    const data = {
      exportedAt: new Date().toISOString(), source: 'operator-supplied AI workbench test',
      input: { ...input, ...(sentImage ? { image: { name: sentImage.name, width: sentImage.width, height: sentImage.height, bytes: sentImage.bytes, mimeType: sentImage.mimeType, ...(includeImages ? { dataUrl: sentImage.dataUrl } : {}) } } : {}) },
      results: rows.map(row => ({ ...row, ...(row.analysis ? { analysis: { ...row.analysis, pieces: row.analysis.pieces.map(piece => { const { crop, ...detail } = piece; return { ...detail, ...(includeImages && crop ? { crop } : {}) }; }) } } : {}) })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'almari-model-comparison.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const needsImage = mode === 'flatlay' || mode === 'worn';
  const disabled = running || preparing;

  return (
    <section aria-label="AI workbench" className="space-y-6 min-w-0">
      <Card>
        <SectionTitle aside="deliberately supplied test material">AI workbench</SectionTitle>
        <p className="text-[14px] text-text-2 leading-relaxed">Compare the same input across up to four models, one call at a time. Images, prompts, answers and review notes stay in this page's memory until cleared or reloaded. Running sends the displayed prompt and prepared image to the selected providers through the admin service. This workbench never reads a wardrobe from the app.</p>
        <p className="text-[13px] text-text-2 mt-3">The models return text and coordinates. Image previews below are local rectangular crops, not generated images or background removal. Costs are estimates from returned usage and published rates, not invoices.</p>
      </Card>

      <Card>
        <SectionTitle>Test input</SectionTitle>
        <fieldset disabled={disabled} className="min-w-0 space-y-5">
          <Field label="AI feature" htmlFor="bench-feature">
            <select id="bench-feature" className={inputClass} value={mode} onChange={event => applyPreset(event.target.value as WorkbenchMode)}>
              {modes.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </Field>
          {mode === 'event' ? (
            <Field label="Event test case JSON" htmlFor="bench-event" hint="Synthetic example. Edit only data you intend to send. No weather service is called; label supplied weather honestly.">
              <textarea id="bench-event" rows={12} className={`${inputClass} font-mono text-[13px]`} maxLength={100000} value={eventJson} onChange={event => { setEventJson(event.target.value); setEventDirty(true); }} />
              <Button className="mt-3" onClick={() => applyPreset()}>Apply event data</Button>
              {eventDirty && <p className="text-[13px] text-text-2 mt-2">Apply the changed event data before running.</p>}
            </Field>
          ) : (
            <Field label="Test image" htmlFor="bench-image" hint={needsImage ? 'Required. JPEG, PNG or WebP, up to 12 MB. Prepared as JPEG with a 1400px longest edge.' : 'Optional for a custom prompt. JPEG, PNG or WebP, up to 12 MB.'}>
              <input ref={fileInput} id="bench-image" type="file" accept="image/jpeg,image/png,image/webp" className={inputClass} onChange={event => void upload(event.target.files?.[0])} />
              {image && <div className="bench-image-preview mt-3">
                <img src={image.dataUrl} alt="Prepared test image" />
                <p className="text-[13px] text-text-2 mt-2 break-words">{image.name} · sent {image.width} × {image.height}px · {Math.ceil(image.bytes / 1024)} KB JPEG (original {Math.ceil(image.originalBytes / 1024)} KB). The prepared image is shown here.</p>
                <Button className="mt-2" onClick={() => { setImage(null); if (fileInput.current) fileInput.current.value = ''; }}>Remove image</Button>
              </div>}
            </Field>
          )}
          <details>
            <summary className="min-h-11 flex items-center cursor-pointer text-[14px] text-text underline">Review or edit the exact prompt</summary>
            <div className="space-y-4 mt-3">
              <Field label="System instructions" htmlFor="bench-system" hint="Photo presets have no separate system instruction, matching the app.">
                <textarea id="bench-system" rows={6} className={`${inputClass} font-mono text-[13px]`} maxLength={20000} value={system} onChange={event => setSystem(event.target.value)} />
              </Field>
              <Field label="Prompt sent to each model" htmlFor="bench-prompt" hint={mode === 'event' ? 'Generated from the event JSON. Edit the case and press Apply event data so validation uses the same garment IDs. Use Custom prompt for unrestricted prompt experiments.' : undefined}>
                <textarea id="bench-prompt" rows={12} className={`${inputClass} font-mono text-[13px]`} maxLength={120000} readOnly={mode === 'event'} value={prompt} onChange={event => setPrompt(event.target.value)} />
              </Field>
              <Button onClick={() => applyPreset()}>Restore feature prompt</Button>
            </div>
          </details>
        </fieldset>
      </Card>

      <Card>
        <SectionTitle>Models and call limit</SectionTitle>
        <fieldset disabled={disabled} className="min-w-0">
          <legend className="text-[14px] text-text-2 mb-3">Choose up to four models for this run</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            {MODEL_CATALOG.map(model => <label key={model.id} className="flex gap-3 min-h-11 items-start border border-border rounded-[2px] p-3">
              <input type="checkbox" className="w-4 h-4 mt-1 shrink-0 accent-accent" checked={models.includes(model.id)} disabled={!models.includes(model.id) && models.length >= 4} onChange={event => setModels(previous => event.target.checked ? [...previous, model.id] : previous.filter(id => id !== model.id))} />
              <span className="min-w-0"><span className="block text-[14px] text-text">{model.label}</span><span className="block font-mono text-[11px] text-text-2 break-all">{model.id}</span><span className="block text-[12px] text-text-2 mt-1">{model.provider} · {model.pricing.kind === 'subscription' ? 'Subscription; per-call price unavailable' : 'Usage-based price estimate after the call'}</span></span>
            </label>)}
          </div>
          <div className="max-w-xs mt-4"><Field label="Maximum tokens per call" htmlFor="bench-tokens" hint="A ceiling, not a price quote. Reasoning models need room for thinking and the answer.">
            <input id="bench-tokens" type="number" min={512} max={16000} step={512} className={inputClass} value={maxTokens} onChange={event => setMaxTokens(Number(event.target.value))} />
          </Field></div>
        </fieldset>
        <div className="flex flex-wrap gap-3 mt-5">
          <Button tone="primary" onClick={() => void run()} disabled={disabled || !token.trim() || !prompt.trim() || !models.length || eventDirty || (needsImage && !image)}>Run selected models</Button>
          {running && <Button onClick={() => controller.current?.abort()}>Cancel run</Button>}
          <Button onClick={clear}>Clear test and results</Button>
        </div>
        <p className="text-[13px] text-text-2 mt-3" role="status" aria-live="polite">{preparing ? 'Preparing the image locally.' : running ? `Running ${rows.find(row => row.status === 'running') ? labelFor(rows.find(row => row.status === 'running')!.modelId) : 'the selected models'}. Remaining models wait their turn.` : !token.trim() ? 'Enter the admin token above before running.' : 'Nothing runs when you open this panel, choose a model or edit an input.'}</p>
        {error && <p role="alert" className="text-[14px] text-text mt-3">{error}</p>}
      </Card>

      {snapshot && rows.length > 0 && <Card>
        <SectionTitle>Comparison</SectionTitle>
        <p className="text-[13px] text-text-2 mb-4">Input captured {snapshot.capturedAt}. The same prepared input and token ceiling were used for every selected model. A new run replaces this comparison.</p>
        <TableRail label="Model comparison">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead><tr>{['Model', 'Status / validation', 'Latency', 'Input tokens', 'Output tokens', 'Estimated USD'].map(label => <th key={label} className="font-medium p-2 border-b border-border whitespace-nowrap">{label}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.modelId}>
              <td className="p-2 border-b border-border">{labelFor(row.modelId)}</td>
              <td className="p-2 border-b border-border">{row.status}{row.analysis ? ` / ${row.analysis.status}` : ''}</td>
              <td className="p-2 border-b border-border whitespace-nowrap">{row.result ? `${row.result.latencyMs} ms` : 'Not returned'}</td>
              <td className="p-2 border-b border-border">{number(row.usage?.inputTokens)}</td>
              <td className="p-2 border-b border-border">{number(row.usage?.outputTokens)}</td>
              <td className="p-2 border-b border-border">{row.cost?.label ?? (row.status === 'queued' || row.status === 'not-run' ? 'Not called' : 'Unavailable')}</td>
            </tr>)}</tbody>
          </table>
        </TableRail>
        <details className="mt-4"><summary className="min-h-11 flex items-center text-[14px] underline cursor-pointer">Input used for this run</summary><pre className="bench-json">{JSON.stringify({ mode: snapshot.mode, system: snapshot.system, prompt: snapshot.prompt, maxTokens: snapshot.maxTokens, image: snapshot.image ? { name: snapshot.image.name, width: snapshot.image.width, height: snapshot.image.height, bytes: snapshot.image.bytes } : null }, null, 2)}</pre></details>
        <div className="flex flex-wrap gap-3 items-center mt-4">
          <Button onClick={exportResults} disabled={running}>Export comparison JSON</Button>
          <label className="inline-flex gap-2 items-center min-h-11 text-[13px]"><input type="checkbox" checked={includeImages} onChange={event => setIncludeImages(event.target.checked)} />Include prepared image and crops in export</label>
        </div>
        <p className="text-[12px] text-text-2 mt-2">Export includes prompts, answers, usage, price sources and review notes. The admin token is excluded. Image bytes are excluded unless the box is checked.</p>
      </Card>}

      {rows.map(row => <Card key={row.modelId}>
        <section aria-label={`Result: ${labelFor(row.modelId)}`}>
          <SectionTitle aside={row.status}>{labelFor(row.modelId)}</SectionTitle>
          {row.error && <p role="alert" className="text-[14px] text-text">{row.error}</p>}
          {row.result && <>
            <p className="text-[13px] text-text-2 break-words">Requested {row.result.requestedModel}; returned model: {row.result.returnedModel}. {row.result.latencyMs} ms. {row.cost?.label}</p>
            <p className="text-[13px] text-text-2 mt-2">Usage: {row.usage?.status}. Reasoning tokens: {number(row.usage?.reasoningTokens)}. Cached input: {number(row.usage?.cacheReadInputTokens)}.</p>
            {row.cost && <p className="text-[12px] text-text-2 mt-2"><a href={row.cost.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline">Price source</a> · checked {row.cost.verifiedAt}. {[...row.cost.notes, ...(row.usage?.notes ?? [])].join(' ')}</p>}
            {row.analysis && <>
              <p className="text-[14px] text-text mt-4">{row.analysis.summary}</p>
              {row.analysis.issues.length > 0 && <ul className="list-disc pl-5 mt-2 space-y-1 text-[13px] text-text-2">{row.analysis.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
              {row.analysis.suggestion && <div className="mt-4 space-y-2 text-[14px]">
                <h3 className="font-medium">{row.analysis.suggestion.name}</h3>
                <p>{row.analysis.suggestion.itemIds.map(id => snapshot?.items.find(item => item.id === id)?.name ?? id).join(' · ')}</p>
                <p>{row.analysis.suggestion.rationale}</p><p>{row.analysis.suggestion.weatherNote}</p><p>{row.analysis.suggestion.eventNote}</p>
                {row.analysis.suggestion.missing.length > 0 && <p>Unmet needs: {row.analysis.suggestion.missing.join(' · ')}</p>}
              </div>}
              {snapshot?.image && row.analysis.pieces.some(piece => piece.box) && <div className="bench-image-preview mt-4">
                <div className="relative"><img src={snapshot.image.dataUrl} alt={`Prepared source with ${labelFor(row.modelId)} crop boxes`} /><svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${snapshot.image.width} ${snapshot.image.height}`} aria-hidden="true">{row.analysis.pieces.map(piece => piece.box ? <rect key={piece.ref} x={piece.box[0] * snapshot.image!.width} y={piece.box[1] * snapshot.image!.height} width={piece.box[2] * snapshot.image!.width} height={piece.box[3] * snapshot.image!.height} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null)}</svg></div>
                <p className="text-[12px] text-text-2 mt-2">Validated coordinate boxes on the exact image sent.</p>
              </div>}
              {row.analysis.pieces.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">{row.analysis.pieces.map(piece => <div key={piece.ref} className="border border-border rounded-[2px] p-3 min-w-0">
                {piece.crop && <img src={piece.crop} alt={`Local crop: ${piece.name}`} className="w-full h-36 object-contain bg-mat" />}
                <h3 className="text-[14px] mt-2 break-words">{piece.name}</h3><p className="text-[12px] text-text-2 mt-1 break-words">{piece.description}</p>
                <p className="text-[12px] text-text-2 mt-2">Model confidence: {piece.confidence.toFixed(2)}{piece.uncertain.length ? ` · uncertain: ${piece.uncertain.join(', ')}` : ''}</p>
              </div>)}</div>}
            </>}
            <details className="mt-4"><summary className="min-h-11 flex items-center text-[14px] underline cursor-pointer">Answer text</summary><pre className="bench-json">{row.result.text || '(No text)'}</pre></details>
            <details><summary className="min-h-11 flex items-center text-[14px] underline cursor-pointer">Raw provider response and usage</summary><pre className="bench-json">{JSON.stringify(row.result.raw, null, 2)}</pre></details>
            <Field label={`Review notes for ${labelFor(row.modelId)}`} htmlFor={`review-${row.modelId}`} hint="Your qualitative assessment, kept in memory and included only in an explicit export.">
              <textarea id={`review-${row.modelId}`} rows={3} className={inputClass} maxLength={3000} value={row.note} onChange={event => setRows(previous => previous.map(entry => entry.modelId === row.modelId ? { ...entry, note: event.target.value } : entry))} />
            </Field>
          </>}
          {(row.status === 'queued' || row.status === 'not-run') && <p className="text-[14px] text-text-2">{row.status === 'queued' ? 'Waiting for the preceding call.' : 'This model was not called.'}</p>}
        </section>
      </Card>)}
    </section>
  );
}
