import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import dayjs from "dayjs";

import { fetchWeatherWidget } from "../api/weatherWidget";

const LOCATION = "Henrietta, NY";
const POLL_MS = 10 * 60_000; // refresh every 10 min

// ── WMO weather-code → emoji ──────────────────────────────────────────────────
function wmoEmoji(code) {
  if (code === 0)  return "☀️";
  if (code <= 2)   return "⛅";
  if (code === 3)  return "☁️";
  if (code <= 48)  return "🌫️";
  if (code <= 57)  return "🌦️";
  if (code <= 67)  return "🌧️";
  if (code <= 77)  return "🌨️";
  if (code <= 82)  return "🌦️";
  if (code <= 86)  return "🌨️";
  return "⛈️";
}

// ── ordinal suffix ("st", "nd", "rd", "th") ───────────────────────────────────
function ordinal(n) {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatDate(d) {
  const day = d.date();
  return `${d.format("MMM")} ${day}${ordinal(day)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WeatherWidget() {
  const [data,  setData]  = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const json = await fetchWeatherWidget();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e?.message ?? "Failed to load weather");
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // ── error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card sx={{ backgroundColor: "var(--bg)", border: "2px solid var(--outline)", boxShadow: "none", height: "100%" }}>
        <CardContent>
          <Typography color="error" variant="body2">{error}</Typography>
        </CardContent>
      </Card>
    );
  }

  // ── loading state ─────────────────────────────────────────────────────────
  if (!data) {
    return (
      <Card sx={{ backgroundColor: "var(--bg)", border: "2px solid var(--outline)", boxShadow: "none", height: "100%" }}>
        <CardContent>
          <Typography variant="body2" color="text.disabled">Loading weather…</Typography>
        </CardContent>
      </Card>
    );
  }

  // ── parse response ────────────────────────────────────────────────────────
  const { current, daily } = data;
  const currentTemp = Math.round(current.temperature_2m);
  const currentCode = current.weather_code;
  const todayHi     = Math.round(daily.temperature_2m_max[0]);
  const todayLo     = Math.round(daily.temperature_2m_min[0]);

  // indices 1–4 = next 4 days
  const forecast = [1, 2, 3, 4].map((i) => ({
    day:  dayjs(daily.time[i]).format("ddd").toUpperCase(),
    hi:   Math.round(daily.temperature_2m_max[i]),
    lo:   Math.round(daily.temperature_2m_min[i]),
    icon: wmoEmoji(daily.weather_code[i]),
  }));

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Card
      sx={{
        backgroundColor: "var(--bg)",
        border: "2px solid var(--outline)",
        boxShadow: "none",
        height: 270,
      }}
    >
      <CardContent sx={{ p: 2, pt: 3, "&:last-child": { pb: 2 } }}>

        {/* ── Card header ── */}
        <Typography variant="h3" align="center" sx={{ mb: 1.5 }}>
          Today's Weather
        </Typography>

        {/* ── Current conditions ── */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">

          {/* Left: location label + big temperature */}
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.5, fontSize: "0.7rem" }}>
              {LOCATION}
            </Typography>
            <Typography
              sx={{ fontSize: "3rem", fontWeight: 700, color: "#FE9805", lineHeight: 1.1 }}
            >
              {currentTemp}°
            </Typography>
          </Box>

          {/* Right: date / icon / HI·LO */}
          <Stack alignItems="flex-end" spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              {formatDate(dayjs())}
            </Typography>

            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ fontSize: "2.6rem", lineHeight: 1 }}>
                {wmoEmoji(currentCode)}
              </Box>

              <Stack spacing={0.25}>
                <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                  LO: <strong>{todayLo}°</strong>
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                  HI: <strong>{todayHi}°</strong>
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {/* ── 4-day forecast ── */}
        <Stack direction="row" justifyContent="space-around">
          {forecast.map((f) => (
            <Stack key={f.day} alignItems="center" spacing={0.5}>
              <Typography sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.65rem" }}>
                {f.day}
              </Typography>
              <Box sx={{ fontSize: "1.6rem", lineHeight: 1 }}>{f.icon}</Box>
              <Typography variant="body2" sx={{ fontWeight: 400 }}>{f.hi}°</Typography>
              <Typography variant="caption" color="text.secondary">{f.lo}°</Typography>
            </Stack>
          ))}
        </Stack>

      </CardContent>
    </Card>
  );
}
