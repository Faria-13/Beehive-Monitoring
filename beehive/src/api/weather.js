import { supabase } from "../createClient";

export async function fetchWeatherByRange(startISO, endISO) {
  const { data, error } = await supabase.rpc("get_daily_avg_weather", {
    start_ts: startISO,
    end_ts: endISO,
  });

  if (error) throw error;
  return data ?? [];
}
