import { createClient } from "npm:@supabase/supabase-js@2";

const HIVE_ID = 101;
const BOARD_ID = 1;

function decodeBase64Payload(frmPayload: string) {
  if (!frmPayload) return null;

  try {
    const binary = atob(frmPayload);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

    if (bytes.length < 10) {
      return {
        error: "Invalid payload length",
        raw_bytes: Array.from(bytes),
      };
    }

    function toUint16LE(lo: number, hi: number) {
      return (hi << 8) | lo;
    }

    function toInt16LE(lo: number, hi: number) {
      let val = (hi << 8) | lo;
      if (val & 0x8000) val -= 0x10000;
      return val;
    }

    return {
      co2_ppm: toUint16LE(bytes[0], bytes[1]),
      battery_percent: toInt16LE(bytes[2], bytes[3]) / 100.0,
      humidity_percent: toUint16LE(bytes[4], bytes[5]) / 100.0,
      temperature_c: toInt16LE(bytes[6], bytes[7]) / 100.0,
      pressure_hpa: toUint16LE(bytes[8], bytes[9]) / 10.0,
      raw_bytes: Array.from(bytes),
    };
  } catch (err) {
    return {
      error: `Base64 decode failed: ${String(err)}`,
    };
  }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const endDeviceIds = body.end_device_ids || {};
    const uplink = body.uplink_message || {};

    // Use TTN decoded payload if present, otherwise decode frm_payload here
    let decoded = uplink.decoded_payload || null;
    if (!decoded && uplink.frm_payload) {
      decoded = decodeBase64Payload(uplink.frm_payload);
    }
    if (!decoded) {
      decoded = {};
    }

    const timestamp =
      body.received_at ||
      uplink.received_at ||
      new Date().toISOString();

    const deviceId = endDeviceIds.device_id || null;
    const devEui = endDeviceIds.dev_eui || null;

    console.log(
      JSON.stringify(
        {
          event_name: body.name || null,
          device_id: deviceId,
          dev_eui: devEui,
          frm_payload: uplink.frm_payload || null,
          decoded_payload: decoded,
        },
        null,
        2,
      ),
    );

    const readings = [
      {
        sensor_id: 1,
        value: decoded.co2_ppm ?? null,
        unit: "ppm",
        is_valid: decoded.co2_ppm != null,
        error_flag: false,
      },
      {
        sensor_id: 2,
        value: decoded.battery_percent ?? null,
        unit: "%",
        is_valid: decoded.battery_percent != null,
        error_flag: false,
      },
      {
        sensor_id: 3,
        value: decoded.humidity_percent ?? null,
        unit: "%",
        is_valid: decoded.humidity_percent != null,
        error_flag: false,
      },
      {
        sensor_id: 4,
        value: decoded.temperature_c ?? null,
        unit: "C",
        is_valid: decoded.temperature_c != null,
        error_flag: false,
      },
      {
        sensor_id: 5,
        value: decoded.pressure_hpa ?? null,
        unit: "hPa",
        is_valid: decoded.pressure_hpa != null,
        error_flag: false,
      },
    ].filter((r) => r.value !== null);

    const batteryReading = readings.find((r) => r.sensor_id === 2);
    const filteredReadings = readings.filter((r) => r.sensor_id !== 2);

    const rows = filteredReadings.map((r) => ({
      sensor_id: r.sensor_id,
      value: r.value,
      unit: r.unit,
      is_valid: r.is_valid,
      error_flag: r.error_flag,
      timestamp,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("sensor_readings")
        .insert(rows);

      if (insertError) {
        console.error("DATABASE INSERT ERROR:", insertError.message);
        throw new Error(`Sensor Insert Failed: ${insertError.message}`);
      }
    }

    const boardUpdate: Record<string, unknown> = {
      updated_at: timestamp,
      last_heartbeat: timestamp,
      status: "online",
    };

    if (batteryReading) {
      boardUpdate.battery_level = batteryReading.value;
    }

    const { error: updateError } = await supabase
      .from("iot_boards")
      .update(boardUpdate)
      .eq("board_id", BOARD_ID);

    if (updateError) {
      console.error("BOARD UPDATE ERROR:", updateError.message);
      throw new Error(`Board Update Failed: ${updateError.message}`);
    }

    const alertPayload = {
      hive_id: HIVE_ID,
      temperature: decoded.temperature_c ?? null,
      humidity: decoded.humidity_percent ?? null,
      carbon: decoded.co2_ppm ?? null,
      pressure: decoded.pressure_hpa ?? null,
    };

    const evalRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/evaluate-alerts`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alertPayload),
      },
    );

    if (!evalRes.ok) {
      const evalText = await evalRes.text();
      console.error("evaluate-alerts failed:", evalText);
    } else {
      console.log("evaluate-alerts called with:", JSON.stringify(alertPayload));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        device_id: deviceId,
        dev_eui: devEui,
        inserted_sensor_rows: rows.length,
        battery_updated: !!batteryReading,
        decoded_payload: decoded,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("FARIA FUNCTION ERROR:", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err),
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});