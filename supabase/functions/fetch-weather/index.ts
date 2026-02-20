import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const lat = 43.0848;
    const lon = -77.6744;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Weather API failed: ${res.status}`);
    }

    const data = await res.json();

    if (!data?.current) {
      throw new Error("Invalid weather response");
    }

    const { error } = await supabase
      .from("weather_logs")
      .insert({
        location: "RIT Campus",
        latitude: lat,
        longitude: lon,
        timestamp: new Date().toISOString(),
        temp_c: data.current.temperature_2m,
        wind_kmh: data.current.wind_speed_10m,
        weather: {
          humidity: data.current.relative_humidity_2m,
          weather_code: data.current.weather_code,
        },
      });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ status: "ok", weather: data.current }),
      { status: 200 }
    );

  } catch (err) {
    console.error("Weather function error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500 }
    );
  }
});
