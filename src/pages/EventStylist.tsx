import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWardrobe } from '../context/WardrobeContext';
import { confirmWrite } from '../hooks/useLocalStorage';
import { Button, Card, Field, LinkButton, Masthead, SectionTitle, inputClass, selectClass } from '../components/ui';
import { GarmentPlate } from '../components/art';
import { photoSrc } from '../lib/photoStore';
import { todayLocal } from '@almari/shared/dates';
import { aiStylistDisclosure, askStylistText } from '../lib/anthropic';
import { buildStylistPrompt, eligibleStylistItems, parseStyleSuggestion, type EventBrief, type StyleSuggestion, type StyleWeather } from '../lib/eventStylist';
import { fetchEventWeather, findWeatherCities, type WeatherCity } from '../lib/eventWeather';

/** Drafts and requests belong to this mounted wardrobe. Only an accepted outfit is persisted. */
function EventStylistForm() {
  const { items, settings, circle, packedItemIds, events, addOutfit, updateEvent } = useWardrobe();
  const [params] = useSearchParams();
  const event = events.find(e => e.id === params.get('event'));
  const initialDate = params.get('date') || event?.startDate || todayLocal();
  const [brief, setBrief] = useState<EventBrief>({ event: event?.name ?? '', date: initialDate, time: '18:00', dressCode: '', setting: 'mixed', preferences: '' });
  const [cityQuery, setCityQuery] = useState(event?.place ?? '');
  const [cities, setCities] = useState<WeatherCity[]>([]);
  const [city, setCity] = useState<WeatherCity | null>(null);
  const [forecast, setForecast] = useState<StyleWeather | null>(null);
  const [manual, setManual] = useState('');
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ suggestion: StyleSuggestion; model: string; weather: StyleWeather } | null>(null);
  const [refinement, setRefinement] = useState('');
  const [saved, setSaved] = useState(false);
  const [reserved, setReserved] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [reserveConfirmed, setReserveConfirmed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const weatherRequest = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const liveResult = useRef(result);
  liveResult.current = result;
  const lentNames = useMemo(() => new Set(circle.loans.filter(l => l.direction === 'to' && !l.returned).map(l => l.pieceName)), [circle.loans]);
  const lentIds = useMemo(() => new Set(circle.loans.filter(l => l.direction === 'to' && !l.returned && l.itemId).map(l => l.itemId)), [circle.loans]);
  const available = useMemo(() => eligibleStylistItems(items, settings.categories, packedItemIds, lentNames).filter(i => !lentIds.has(i.id)), [items, settings.categories, packedItemIds, lentNames, lentIds]);
  const inventoryVersion = JSON.stringify(available.map(i => [i.id, i.name, i.category, i.color, i.material, i.pattern, i.season, i.occasion]));
  const disclosure = aiStylistDisclosure();
  const weather: StyleWeather = forecast ?? { source: manual.trim() ? 'manual' : 'unknown', summary: manual.trim() || 'Weather has not been supplied. Do not assume conditions.', date: brief.date, time: brief.time };
  const reservation = event?.reservations.find(r => r.date === brief.date);

  function invalidate() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setResult(null);
    setSaved(false);
    setReserved(false);
    setSaveConfirmed(false);
    setReserveConfirmed(false);
    setError('');
  }

  function clearForecast() {
    weatherRequest.current?.abort();
    weatherRequest.current = null;
    setWeatherBusy(false);
    setForecast(null);
    setWeatherError('');
  }

  function edit<K extends keyof EventBrief>(key: K, value: EventBrief[K]) {
    invalidate();
    if (key === 'date' || key === 'time') clearForecast();
    setBrief(b => ({ ...b, [key]: value }));
  }

  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setResult(null);
    setSaved(false);
    setReserved(false);
  }, [inventoryVersion]);

  useEffect(() => () => { request.current?.abort(); weatherRequest.current?.abort(); liveResult.current = null; }, []);
  useEffect(() => {
    if (result) {
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }, [result]);

  async function searchCity() {
    clearForecast();
    invalidate();
    setCities([]);
    setCity(null);
    const controller = new AbortController();
    weatherRequest.current = controller;
    setWeatherBusy(true);
    try {
      const found = await findWeatherCities(cityQuery, controller.signal);
      if (controller.signal.aborted) return;
      setCities(found);
      if (!found.length) setWeatherError('No city found. Try a nearby city or enter the weather yourself.');
    } catch (e) {
      if (!controller.signal.aborted) setWeatherError(e instanceof Error ? e.message : 'The city lookup could not finish. Try again or enter the weather yourself.');
    } finally {
      if (weatherRequest.current === controller) { weatherRequest.current = null; setWeatherBusy(false); }
    }
  }

  async function checkForecast() {
    if (!city) return;
    clearForecast();
    invalidate();
    const controller = new AbortController();
    weatherRequest.current = controller;
    setWeatherBusy(true);
    try {
      const next = await fetchEventWeather(city, brief.date, brief.time, controller.signal);
      if (!controller.signal.aborted) { setForecast(next); setManual(''); }
    } catch (e) {
      if (!controller.signal.aborted) setWeatherError(e instanceof Error ? e.message : 'The forecast could not finish. Enter the weather yourself or try again.');
    } finally {
      if (weatherRequest.current === controller) { weatherRequest.current = null; setWeatherBusy(false); }
    }
  }

  async function suggest(update = false) {
    if (!consent || !available.length || !brief.event.trim() || !brief.date || !brief.time || busy) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const sentWeather = { ...weather };
      const prompt = buildStylistPrompt(brief, sentWeather, available, settings.categories, update ? result?.suggestion : undefined, update ? refinement : undefined);
      const answer = await askStylistText(prompt.system, prompt.prompt, controller.signal);
      if (controller.signal.aborted) return;
      const suggestion = parseStyleSuggestion(answer.text, available);
      setSaved(false);
      setReserved(false);
      setSaveConfirmed(false);
      setReserveConfirmed(false);
      setResult({ suggestion, model: answer.model, weather: sentWeather });
      setRefinement('');
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'The outfit request could not finish. Try again.');
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }

  function resultStillAvailable() {
    return result && result.suggestion.itemIds.every(id => available.some(i => i.id === id));
  }

  function save() {
    if (!result || saved || busy || !resultStillAvailable()) return;
    const s = result.suggestion;
    addOutfit({ name: s.name, itemIds: s.itemIds, favorite: false,
      stylingNote: s.rationale,
      notes: `${brief.event} · ${brief.date} ${brief.time}\nAI: ${result.model}\n${s.eventNote}\n${s.weatherNote}\nWeather (${result.weather.source}): ${result.weather.summary}` });
    setSaved(true);
    confirmWrite(() => { if (liveResult.current === result) setSaveConfirmed(true); }, () => setError('The device could not keep this outfit. It remains in this session; export a backup from Settings.'));
  }

  function reserve() {
    if (!result || !event || !reservation || reserved || busy || !resultStillAvailable()) return;
    updateEvent(event.id, { reservations: event.reservations.map(r => r.id === reservation.id
      ? { ...r, outfitId: undefined, itemIds: result.suggestion.itemIds, notes: `${result.suggestion.name}\n${result.suggestion.rationale}\n${result.suggestion.eventNote}\n${result.suggestion.weatherNote}\nWeather (${result.weather.source}, ${brief.date} ${brief.time}): ${result.weather.summary}\nAI: ${result.model}` }
      : r) });
    setReserved(true);
    confirmWrite(() => { if (liveResult.current === result) setReserveConfirmed(true); }, () => setError('The device could not keep this reservation. It remains in this session; export a backup from Settings.'));
  }

  return (
    <div className="space-y-6">
      <Masthead title="What should I wear?" meta="From your closet" action={<LinkButton to="/events">Events</LinkButton>} />
      <p className="text-[15px] text-text-2 leading-relaxed max-w-[65ch]">Tell AI what you are dressing for. Check the forecast or describe the weather, then adjust the outfit until it suits your plans.</p>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card>
            <SectionTitle>The occasion</SectionTitle>
            <div className="space-y-4">
              <Field label="Event" htmlFor="style-event"><input id="style-event" className={inputClass} placeholder="An outdoor wedding, a work dinner…" value={brief.event} maxLength={240} onChange={e => edit('event', e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" htmlFor="style-date"><input id="style-date" type="date" className={`${inputClass} min-w-0`} value={brief.date} onChange={e => edit('date', e.target.value)} /></Field>
                <Field label="Time" htmlFor="style-time"><input id="style-time" type="time" className={`${inputClass} min-w-0`} value={brief.time} onChange={e => edit('time', e.target.value)} /></Field>
              </div>
              <Field label="Dress code" htmlFor="style-code" hint="Optional. Use the wording on the invitation."><input id="style-code" className={inputClass} placeholder="Smart casual, festive, black tie…" value={brief.dressCode} maxLength={160} onChange={e => edit('dressCode', e.target.value)} /></Field>
              <Field label="Setting" htmlFor="style-setting"><select id="style-setting" className={selectClass} value={brief.setting} onChange={e => edit('setting', e.target.value as EventBrief['setting'])}><option value="mixed">Indoors and outdoors</option><option value="indoors">Indoors</option><option value="outdoors">Outdoors</option></select></Field>
              <Field label="Preferences" htmlFor="style-preferences" hint="Optional. Comfort, walking, layers, or a piece you want to wear."><textarea id="style-preferences" rows={2} className={inputClass} maxLength={500} value={brief.preferences} onChange={e => edit('preferences', e.target.value)} /></Field>
            </div>
          </Card>
          <Card>
            <SectionTitle>Weather for the event</SectionTitle>
            <p className="text-[13px] text-text-2 mb-4 leading-relaxed">Find city sends the city you type to Open-Meteo. Check forecast sends that city's coordinates and the date. Forecasts cover up to 16 days; the time is local to the selected city.</p>
            <div className="space-y-4">
              <Field label="City" htmlFor="style-city"><input id="style-city" className={inputClass} placeholder="City name" maxLength={100} value={cityQuery} onChange={e => { invalidate(); clearForecast(); setCity(null); setCities([]); setCityQuery(e.target.value); }} /></Field>
              <Button disabled={cityQuery.trim().length < 2 || weatherBusy} onClick={() => void searchCity()}>Find city</Button>
              {cities.length > 0 && <Field label="Choose a city" htmlFor="style-city-choice"><select id="style-city-choice" className={selectClass} value={city?.id ?? ''} onChange={e => { invalidate(); clearForecast(); setCity(cities.find(c => String(c.id) === e.target.value) ?? null); }}><option value="">Choose the matching city</option>{cities.map(c => <option key={c.id} value={c.id}>{[c.name, c.region, c.country].filter(Boolean).join(', ')}</option>)}</select></Field>}
              {city && <Button disabled={weatherBusy || !brief.date || !brief.time} onClick={() => void checkForecast()}>{forecast ? 'Refresh forecast' : 'Check forecast'}</Button>}
              {weatherBusy && <p role="status" className="text-[14px] text-text-2">Checking the weather service…</p>}
              {weatherError && <p role="status" className="text-[14px] text-text-2">{weatherError}</p>}
              {forecast && <div className="border-l-2 border-accent pl-3" role="status"><p className="text-[15px]">{forecast.summary}</p><p className="text-[12px] text-text-2 mt-1">{city?.name} · {forecast.date} {forecast.time} · {forecast.timezone}</p><p className="text-[12px] text-text-2">Checked {new Date(forecast.fetchedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p></div>}
              <Field label="Manual weather" htmlFor="style-weather" hint="Optional. Use this if the forecast is unavailable or you know the conditions."><input id="style-weather" className={inputClass} maxLength={240} placeholder="Around 18°C, breezy, rain later" value={manual} onChange={e => { invalidate(); clearForecast(); setManual(e.target.value); }} /></Field>
              {!forecast && !manual.trim() && <p className="text-[13px] text-text-2">Weather is unknown. You can still ask for an outfit; AI will state that uncertainty.</p>}
            </div>
          </Card>
        </div>
        <div className="space-y-6 min-w-0">
          <Card>
            <SectionTitle>From this wardrobe</SectionTitle>
            <p className="text-[15px]">{available.length} {available.length === 1 ? 'piece available' : 'pieces available'}</p>
            <p className="text-[13px] text-text-2 leading-relaxed mt-2">Pieces in the wash, awaiting care, packed away, lent out, retired, or in quiet categories stay out of the suggestion.</p>
            {!available.length ? <div className="mt-4 space-y-3"><p className="text-[14px]">Add a few pieces or make some available in the closet to start.</p><LinkButton to="/closet">Open closet</LinkButton></div> : <>
              <details className="mt-4 text-[13px] text-text-2"><summary className="cursor-pointer min-h-11 flex items-center underline">What is sent to AI</summary><p className="leading-relaxed">{disclosure}</p><p className="mt-2 leading-relaxed">Your event, date, time, dress code, setting, preferences and weather; available garment IDs, names, categories, colours, materials, patterns, seasons and occasion tags. Updating also sends the last suggestion and your change request. Photos, costs, brands, garment notes and account details are excluded.</p></details>
              <p className="text-[13px] text-text-2 mt-3 leading-relaxed">{disclosure} Details leave this device only when you ask for an outfit.</p>
              <label className="flex items-center gap-3 min-h-11 text-[14px] mt-3"><input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); if (!e.target.checked) { request.current?.abort(); request.current = null; setBusy(false); } }} />Send these details to AI</label>
              <div className="flex flex-wrap gap-3 mt-4">
                <Button tone={result ? 'secondary' : 'primary'} disabled={!consent || !brief.event.trim() || !brief.date || !brief.time || busy || weatherBusy} onClick={() => void suggest()}>Suggest an outfit</Button>
                {busy && <Button onClick={() => { request.current?.abort(); request.current = null; setBusy(false); setError('Request cancelled. You can try again.'); }}>Cancel request</Button>}
              </div>
              {busy && <p role="status" className="text-[14px] text-text-2 mt-3">Considering the occasion, weather and your clothes…</p>}
              {error && <p role="alert" className="text-[14px] text-text-2 mt-3">{error}</p>}
            </>}
          </Card>
          {result && <Card>
            <p className="type-ledger text-[11px] text-text-2">AI suggestion · {result.model}</p>
            <h2 ref={resultHeading} tabIndex={-1} className="type-editorial text-[26px] leading-tight mt-2 outline-none scroll-mt-24">{result.suggestion.name}</h2>
            <p className="text-[13px] text-text-2 mt-2">{brief.event} · {brief.date} {brief.time}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-5">{result.suggestion.itemIds.map(id => {
              const item = available.find(i => i.id === id);
              if (!item) return null;
              const src = photoSrc(item.imageUrl);
              return <div key={id} className="min-w-0"><div className="aspect-[3/4] bg-mat overflow-hidden rounded-[2px]">{src ? <img src={src} alt={item.name} className="h-full w-full object-contain" /> : <GarmentPlate categoryId={item.category} color={item.color} name={item.name} />}</div><p className="text-[13px] leading-snug mt-2 break-words">{item.name}</p></div>;
            })}</div>
            <p className="text-[15px] leading-relaxed">{result.suggestion.rationale}</p>
            <dl className="text-[14px] leading-relaxed space-y-3 my-4"><div><dt className="font-medium">For the event</dt><dd className="text-text-2">{result.suggestion.eventNote}</dd></div><div><dt className="font-medium">For the weather</dt><dd className="text-text-2">{result.suggestion.weatherNote}</dd><dd className="text-[12px] text-text-2 mt-1">{result.weather.source === 'forecast' ? 'Forecast' : result.weather.source === 'manual' ? 'Weather you supplied' : 'Weather unknown'} · {result.weather.summary}</dd></div></dl>
            {result.suggestion.missing.length > 0 && <p className="text-[14px] text-text-2 mb-4">Closet limitations: {result.suggestion.missing.join(' ')}</p>}
            <Field label="Change the outfit" htmlFor="style-change" hint="For example: keep the shoes, make it warmer, or use a lighter layer."><input id="style-change" className={inputClass} maxLength={500} disabled={busy} value={refinement} onChange={e => setRefinement(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-3 mt-4"><Button tone="primary" disabled={busy || !consent || !refinement.trim()} onClick={() => void suggest(true)}>Update outfit</Button><Button disabled={saved || busy} onClick={save}>{saveConfirmed ? 'Added to outfits' : saved ? 'Added in this session' : 'Save outfit'}</Button>{reservation && <Button disabled={reserved || busy} onClick={reserve}>{reserveConfirmed ? 'Reserved for event' : reserved ? 'Held in this session' : 'Reserve for event'}</Button>}</div>
            {(saved || reserved) && <p role="status" className="text-[14px] text-text-2 mt-3">{saveConfirmed ? 'Added to your outfits. ' : saved ? 'Outfit added in this session. ' : ''}{reserveConfirmed ? 'Reserved in Events. ' : reserved ? 'Held in this session. ' : ''}No wear has been logged.</p>}
            {reservation && <p className="text-[12px] text-text-2 mt-3">Reserving replaces the pieces held for {reservation.label || event?.name} on {reservation.date}. It does not log a wear.</p>}
            {event && !reservation && <p className="text-[13px] text-text-2 mt-3">This date has no held day in the selected event. You can save the outfit.</p>}
          </Card>}
        </div>
      </div>
    </div>
  );
}

/** A different event link starts a new draft and cancels the previous request. */
export default function EventStylist() {
  const [params] = useSearchParams();
  return <EventStylistForm key={params.toString()} />;
}
