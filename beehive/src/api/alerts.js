import { supabase } from "../createClient";

/**
 * Fetch all alerts ordered newest first.
 * @param {Object} opts
 * @param {boolean|null} opts.resolved  - null = all, true = resolved only, false = active only
 */
export async function fetchAlerts({ resolved = null } = {}) {
  let query = supabase
    .from("alerts")
    .select("*")
    .order("timestamp", { ascending: false });

  if (resolved !== null) query = query.eq("resolved", resolved);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Mark an alert as acknowledged.
 */
export async function acknowledgeAlert(alertId) {
  const { data, error } = await supabase
    .from("alerts")
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
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
  const { data, error } = await supabase
    .from("alerts")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("alert_id", alertId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch all active rules, optionally filtered by hive.
 */
export async function fetchRules({ hiveId = null, activeOnly = true } = {}) {
  let query = supabase
    .from("rules")
    .select("*")
    .order("hive_id", { ascending: true });

  if (hiveId !== null) query = query.eq("hive_id", hiveId);
  if (activeOnly)      query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}