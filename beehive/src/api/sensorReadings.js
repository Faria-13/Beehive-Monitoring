import { supabase } from "../createClient";

export async function fetchSensorReadingsByRange(sensorId, startISO, endISO) {
  const { data, error } = await supabase
    .from("sensor_readings")
    .select("timestamp, value, unit")
    .eq("sensor_id", sensorId)
    .eq("is_valid", true)
    .gte("timestamp", startISO)
    .lte("timestamp", endISO)
    .order("timestamp", { ascending: true })

  if (error) throw error;
  return data ?? [];
}

export async function fetchSensorMeta(sensorId) {
  const { data, error } = await supabase
    .from("sensors")
    .select("sensor_type")
    .eq("sensor_id", sensorId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchLatestSensorReading(sensorId) {
  const { data, error } = await supabase
    .from("sensor_readings")
    .select("timestamp, value, unit")
    .eq("sensor_id", sensorId)
    .eq("is_valid", true)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  // PGRST116 = no rows returned — not a real error
  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
}