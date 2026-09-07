import { addDays, todayLocal } from '@almari/shared/dates';
import type { StyleWeather } from './eventStylist';

export interface WeatherCity {
  id: number;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/** City lookup happens only on a press. No device location or stored location. */
async function weatherJson(url: URL, signal?: AbortSignal): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      credentials: 'omit', referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error('Weather unavailable');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Incomplete forecast');
    return data as Record<string, unknown>;
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('The weather service could not answer. Enter the weather yourself or try again.');
  }
}

export async function findWeatherCities(query: string, signal?: AbortSignal): Promise<WeatherCity[]> {
  if (query.trim().length < 2) throw new Error('Enter at least two letters of a city.');
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query.trim().slice(0, 100), count: '5', language: 'en', format: 'json' }).toString();
  const data = await weatherJson(url, signal);
  if (!Array.isArray(data.results)) return [];
  return data.results.flatMap((candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.name !== 'string' || typeof entry.timezone !== 'string' ||
      typeof entry.id !== 'number' || typeof entry.latitude !== 'number' || !Number.isFinite(entry.latitude) ||
      typeof entry.longitude !== 'number' || !Number.isFinite(entry.longitude) ||
      Math.abs(entry.latitude) > 90 || Math.abs(entry.longitude) > 180) return [];
    try { new Intl.DateTimeFormat('en', { timeZone: entry.timezone }); } catch { return []; }
    return [{ id: entry.id, name: entry.name, region: String(entry.admin1 ?? ''), country: String(entry.country ?? ''),
      latitude: entry.latitude, longitude: entry.longitude, timezone: entry.timezone }];
  });
}

export function forecastDateAvailable(date: string, today = todayLocal()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date >= today && date <= addDays(today, 15);
}

const condition = (code: number): string => {
  if (code === 0) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain showers';
  if (code <= 86) return 'snow showers';
  return 'thunderstorms';
};

/** Hours are matched as local wall time at the selected city, never at the device. */
export async function fetchEventWeather(city: WeatherCity, date: string, time: string, signal?: AbortSignal): Promise<StyleWeather> {
  const cityToday = new Intl.DateTimeFormat('en-CA', { timeZone: city.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!forecastDateAvailable(date, cityToday)) throw new Error('Forecasts cover the next 16 days. Enter expected weather for this date.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose an event time for the forecast.');
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(city.latitude), longitude: String(city.longitude), timezone: city.timezone,
    start_date: date, end_date: date,
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m',
    temperature_unit: 'celsius', wind_speed_unit: 'kmh',
  }).toString();
  const data = await weatherJson(url, signal);
  const hourly = data.hourly as Record<string, unknown[]> | undefined;
  const index = hourly?.time?.indexOf(`${date}T${time.slice(0, 2)}:00`) ?? -1;
  const value = (key: string) => hourly?.[key]?.[index];
  const values = ['temperature_2m', 'apparent_temperature', 'precipitation_probability', 'weather_code', 'wind_speed_10m'].map(value);
  if (index < 0 || values.some(n => typeof n !== 'number' || !Number.isFinite(n))) {
    throw new Error('The forecast is incomplete for that hour. Enter the weather yourself or try again.');
  }
  const [temp, feels, rain, code, wind] = values as number[];
  return { source: 'forecast', date, time, timezone: city.timezone, fetchedAt: new Date().toISOString(),
    summary: `${Math.round(temp)}°C, feels like ${Math.round(feels)}°C; ${condition(code)}; ${Math.round(rain)}% chance of precipitation; wind ${Math.round(wind)} km/h.` };
}
