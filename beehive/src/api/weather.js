import { supabase } from "../createClient";

export async function fetchWeatherByRange(startISO, endISO) {
  const { data, error } = await supabase
    .from("weather_logs")
    .select("timestamp, temperature")
    .gte("timestamp", startISO)
    .lte("timestamp", endISO)
    .order("timestamp", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
