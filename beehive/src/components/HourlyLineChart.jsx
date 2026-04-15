import { useEffect, useMemo, useState } from "react";
import { LineChart } from "@mui/x-charts";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { fetchSensorReadingsByRange, fetchSensorMeta } from "../api/sensorReadings";

dayjs.extend(utc);

const POLL_INTERVAL_MS = 5 * 60_000; // refresh every 5 minutes

// ── small labelled stat box ───────────────────────────────────────────────────
function StatBox({ label, value, unit }) {
  const display =
    value === null ? "—" : `${Math.round(value * 100) / 100}${unit ?? ""}`;

  return (
    <Box
      sx={{
        flex: 1,
        border: "2px solid var(--outline)",
        borderRadius: "14px",
        px: 2,
        py: 1.25,
        textAlign: "center",
        backgroundColor: "var(--bg)",
      }}
    >
      <Typography
        variant="caption"
        sx={{ display: "block", color: "text.secondary", mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {display}
      </Typography>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function HourlyLineChart({
  sensorId,
  sensorOptions = [],
  onSensorChange,
}) {
  const [readings, setReadings] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [sensorType, setSensorType] = useState("Sensor");

  // Load sensor metadata whenever sensorId changes
  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        const meta = await fetchSensorMeta(sensorId);
        if (!cancelled && meta?.sensor_type) setSensorType(meta.sensor_type);
      } catch {
        if (!cancelled) setSensorType("Sensor");
      }
    }
    if (sensorId) loadMeta();
    return () => { cancelled = true; };
  }, [sensorId]);

  // Load 24-hour readings + polling
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        setReadings(null);

        const endISO = dayjs().toISOString();
        const startISO = dayjs().subtract(24, "hour").toISOString();

        const data = await fetchSensorReadingsByRange(sensorId, startISO, endISO);
        if (!cancelled) setReadings(data);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load readings");
          setReadings([]);
        }
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sensorId]);

  // Build hourly-bucketed chart data
  const chartData = useMemo(() => {
    if (readings === null) return null;
    if (readings.length === 0) return { xData: [], yData: [], unit: "" };

    const now = dayjs();
    const hourKeys = [];
    for (let i = 23; i >= 0; i--) {
      hourKeys.push(now.subtract(i, "hour").startOf("hour").format("YYYY-MM-DD HH"));
    }

    const buckets = new Map();
    for (const r of readings) {
      const key = dayjs(r.timestamp).startOf("hour").format("YYYY-MM-DD HH");
      const val = Number(r.value);
      if (!Number.isFinite(val)) continue;
      const existing = buckets.get(key) ?? { sum: 0, count: 0 };
      existing.sum += val;
      existing.count += 1;
      buckets.set(key, existing);
    }

    const xData = hourKeys.map((k) => dayjs(k, "YYYY-MM-DD HH").toDate());
    const yData = hourKeys.map((k) => {
      const b = buckets.get(k);
      if (!b || b.count === 0) return null;
      return Math.round((b.sum / b.count) * 100) / 100;
    });

    const unit = readings.find((r) => r.unit)?.unit ?? "";

    return { xData, yData, unit };
  }, [readings]);

  // Compute high / low / avg from raw readings
  const stats = useMemo(() => {
    if (!readings || readings.length === 0) return { high: null, low: null, avg: null };

    const values = readings
      .map((r) => Number(r.value))
      .filter((v) => Number.isFinite(v));

    if (values.length === 0) return { high: null, low: null, avg: null };

    const high = Math.max(...values);
    const low  = Math.min(...values);
    const avg  = values.reduce((s, v) => s + v, 0) / values.length;

    return { high, low, avg };
  }, [readings]);

  const unit = chartData?.unit ?? "";

  const isReady =
    chartData && chartData.xData.length > 0 && chartData.yData.length === chartData.xData.length;

  return (
    <Card
      sx={{
        backgroundColor: "var(--bg)",
        border: "2px solid var(--outline)",
        boxShadow: "none",
        height: "100%",
      }}
    >
      <CardContent sx={{ backgroundColor: "var(--bg)", pt: 3, pb: 2, "&:last-child": { pb: 2 } }}>
        {/* ── Card title ── */}
        <Typography variant="h3" align="center" sx={{ mb: 1.5 }}>
          24 Hour View
        </Typography>

        {/* ── Sensor tabs ── */}
        {sensorOptions.length > 0 && (
          <Stack
            direction="row"
            spacing={3}
            justifyContent="center"
            alignItems="center"
            sx={{ mb: 1.5, flexWrap: "wrap" }}
          >
            {sensorOptions.map((opt) => {
              const isActive = opt.id === sensorId;
              const canClick = typeof onSensorChange === "function";
              return (
                <Button
                  key={opt.id}
                  variant="text"
                  disableRipple
                  onClick={() => canClick && onSensorChange(opt.id)}
                  sx={{
                    textTransform: "none",
                    minWidth: 0,
                    px: 0.5,
                    py: 0.25,
                    fontWeight: isActive ? 700 : 400,
                    textDecoration: isActive ? "underline" : "none",
                    textUnderlineOffset: "6px",
                    color: "text.primary",
                    opacity: canClick || isActive ? 1 : 0.55,
                  }}
                >
                  {opt.label}
                </Button>
              );
            })}
          </Stack>
        )}

        {error && (
          <Typography sx={{ mb: 2 }} color="error">
            Error: {error}
          </Typography>
        )}

        {readings === null ? (
          <Typography>Loading…</Typography>
        ) : !isReady || !chartData.yData.some((v) => v !== null) ? (
          <Box
            sx={{
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--outline)",
              borderRadius: "14px",
            }}
          >
            <Typography align="center" color="error">
              error: no available data for {sensorType} within the last 24 hours
            </Typography>
          </Box>
        ) : (
          <div className="chartFrame">
            <LineChart
              legend={{ hidden: false }}
              sx={{
                backgroundColor: "transparent",
                "& .MuiChartsSurface-root": { backgroundColor: "transparent" },
              }}
              xAxis={[
                {
                  data: chartData.xData,
                  scaleType: "time",
                  label: "Hour",
                  valueFormatter: (value) =>
                    value == null ? "" : dayjs(value).format("h A"),
                },
              ]}
              yAxis={[
                {
                  label: chartData.unit || "",
                  valueFormatter: (value) =>
                    value == null ? "" : value.toFixed(2),
                },
              ]}
              series={[
                {
                  id: "hive-hourly",
                  data: chartData.yData,
                  label: `${sensorType} (${chartData.unit})`,
                  valueFormatter: (value) =>
                    value == null ? "No data" : value.toFixed(2),
                  color: "#FE9805",
                },
              ]}
              height={300}
            />
          </div>
        )}

        {/* ── Stat boxes ── */}
        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
          <StatBox label="Highest Value" value={stats.high} unit={unit} />
          <StatBox label="Lowest Value"  value={stats.low}  unit={unit} />
          <StatBox label="Average Value" value={stats.avg}  unit={unit} />
        </Stack>
      </CardContent>
    </Card>
  );
}
