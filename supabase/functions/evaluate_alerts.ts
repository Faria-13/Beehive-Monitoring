import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Map sensor types to sensor IDs (board 17, hive 101)
const SENSOR_MAP: Record<string, number> = {
  temperature: 4,
  humidity: 3,
  carbon: 1,
  pressure: 5
};

// Default Hive ID (used if not in payload)
const DEFAULT_HIVE_ID = 101;

// Convert UTC timestamp to EST
function toEST(utc: string) {
  const d = new Date(utc);
  d.setHours(d.getHours() - 4); // UTC → EST
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

serve(async (req: Request) => {
  try {
    const body = await req.json();
    const hive_id = body.hive_id ?? DEFAULT_HIVE_ID;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();

    // Fetch active rules for this hive
    const { data: rules, error: ruleError } = await supabase
      .from("alert_rules")
      .select("*")
      .eq("hive_id", hive_id)
      .eq("is_active", true);

    if (ruleError) throw ruleError;

    for (const rule of rules) {
      const sensorId = SENSOR_MAP[rule.sensor_type];
      if (!sensorId) continue;

      const windowStart = new Date(
        now.getTime() - rule.duration_minutes * 60000
      ).toISOString();

      const { data: logs, error: logsError } = await supabase
        .from("sensor_readings")
        .select("value, timestamp")
        .eq("sensor_id", sensorId)
        .gte("timestamp", windowStart)
        .order("timestamp", { ascending: true });

      if (logsError) throw logsError;
      if (!logs || logs.length === 0) continue;

      let triggered = false;


      if (rule.condition_type === "greater_than") {
        triggered = logs.some((l: any) => Number(l.value) > rule.threshold_value);
      }
      if (rule.condition_type === "less_than") {
        triggered = logs.some((l: any) => Number(l.value) < rule.threshold_value);
      }
      if (rule.condition_type === "rate_of_change") {
        if (logs.length >= 2) {
          const first = Number(logs[0].value);
          const last = Number(logs[logs.length - 1].value);
          const delta = last - first;
          triggered = delta <= rule.threshold_value;
        }
      }

      if (!triggered) continue;

      // Prevent duplicate unresolved alerts
      const { data: existing } = await supabase
        .from("alerts")
        .select("alert_id")
        .eq("rule_id", rule.rule_id)
        .eq("resolved", false)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Build full alert message
      const sensorValue = logs[logs.length - 1].value;
      const estTime = toEST(now.toISOString());
      const message = `
🐝 Hive ${hive_id}
Alert: ${rule.rule_name}
Value: ${sensorValue}${rule.unit || ""}
Condition: ${rule.condition_type}
Threshold: ${rule.threshold_value}
Duration: ${rule.duration_minutes} min
Time: ${estTime} EST
`.trim();

      // Insert alert in DB
      const { error: insertError } = await supabase.from("alerts").insert({
        hive_id,
        rule_id: rule.rule_id,
        alert_type: rule.alert_level,
        alert_level: rule.alert_level,
        message,
        sensor_value: sensorValue,
        timestamp: now.toISOString(),
        acknowledged: false,
        resolved: false,
      });

      if (insertError) throw insertError;

      // Trigger SMS notification
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      console.log("Alert fired and SMS sent:", message);
    }

    return new Response(JSON.stringify({ status: "checked" }), {
      status: 200,
    });
  } catch (err) {
    console.error("EVALUATE ALERTS ERROR:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});