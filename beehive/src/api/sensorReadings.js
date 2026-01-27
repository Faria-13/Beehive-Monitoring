import { supabase } from "../createClient";

export async function fetchSensorReadingsByRange(sensorId, startISO, endISO) {
  const { data, error } = await supabase
    .from("sensor_readings")
    .select("timestamp, value, unit")
    .eq("sensor_id", sensorId)
    .eq("is_valid", true)
    .gte("timestamp", startISO)
    .lte("timestamp", endISO)
    .order("timestamp", { ascending: true });

  if (error) throw error;
  return data ?? [];
}