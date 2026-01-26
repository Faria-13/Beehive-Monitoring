import { supabase } from "../createClient";

export async function fetchSensorReadings(sensorId, limit = 50) {
  const { data, error } = await supabase
    .from("sensor_readings")
    .select("timestamp, value")
    .eq("sensor_id", sensorId)
    .eq("is_valid", true)
    .order("timestamp", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
