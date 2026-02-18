import { supabase } from "../createClient";

export async function fetchWeatherByRange(startISO, endISO) {
  const { data, error } = await supabase
    .from("weather_logs")
    .select(`
      day:DATE(timestamp),
      avg_temp:avg(temp_c)
    `)
    .gte("timestamp", startISO)
    .lte("timestamp", endISO)
    .group("day")
    .order("day", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
