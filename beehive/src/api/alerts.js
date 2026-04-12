import { supabase } from "../createClient";

/**
 * Fetch alerts for a set of hive IDs, ordered newest first.
 * @param {Object} opts
 * @param {number[]} opts.hiveIds   - array of hive IDs to filter by
 * @param {boolean|null} opts.resolved - null = all, true = resolved only, false = active only
 */
export async function fetchAlerts({ hiveIds = [], resolved = null } = {}) {
  let query = supabase
    .from("alerts")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(200);

  if (hiveIds.length > 0) query = query.in("hive_id", hiveIds);
  if (resolved !== null) query = query.eq("resolved", resolved);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Mark an alert as acknowledged.
 */
export async function acknowledgeAlert(alertId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("alerts")
    .update({ acknowledged: true, acknowledged_at: now })
    .eq("alert_id", alertId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark an alert as resolved (also sets acknowledged if not already).
 */
export async function resolveAlert(alertId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("alerts")
    .update({
      resolved: true,
      resolved_at: now,
      acknowledged: true,
      acknowledged_at: now,
    })
    .eq("alert_id", alertId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
