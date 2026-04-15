import { supabase } from "../createClient";

export async function fetchWeatherByRange(startISO, endISO) {
  const { data, error } = await supabase.rpc("get_daily_avg_weather", {
    start_ts: startISO,
    end_ts: endISO,
  });

  if (error) throw error;
  return data ?? [];
}

const LAT = 43.0848;
const LON = -77.6744;
const WEATHER_TIMEZONE = "America/New_York";

export async function fetchHourlyWeatherByRange(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m` +
    `&temperature_unit=fahrenheit` +
    `&timezone=${encodeURIComponent(WEATHER_TIMEZONE)}` +
    `&past_days=2`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hourly weather fetch failed: ${res.status}`);

  const json = await res.json();
  const times = json?.hourly?.time ?? [];
  const temps = json?.hourly?.temperature_2m ?? [];

  return times
    .map((time, index) => ({
      timestamp: time,
      temperature: temps[index] ?? null,
    }))
    .filter((entry) => {
      const ts = new Date(entry.timestamp).getTime();
      return Number.isFinite(ts) && ts >= start.getTime() && ts <= end.getTime();
    });
}
