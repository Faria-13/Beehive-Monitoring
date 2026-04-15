import { useEffect, useMemo, useState } from "react";
import { LineChart } from "@mui/x-charts";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { fetchSensorReadingsByRange, fetchSensorMeta } from "../api/sensorReadings";
import { fetchWeatherByRange } from "../api/weather";

dayjs.extend(utc);

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

// ── clickable underlined date span inside the title ───────────────────────────
function DateSpan({ value, onClick }) {
  return (
    <Box
      component="span"
      onClick={onClick}
      sx={{
        textDecoration: "underline",
        textDecorationStyle: "solid",
        textUnderlineOffset: "4px",
        cursor: "pointer",
        "&:hover": { opacity: 0.65 },
      }}
    >
      {value ? dayjs(value).format("MM/DD") : "__/__"}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SensorLineChartControlled({
  sensorId,
  sensorOptions = [],
  onSensorChange,
  showLocalWeather = false,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) {
  const [readings, setReadings] = useState(null);
  const [weatherReadings, setWeatherReadings] = useState(null);
  const [error, setError] = useState(null);
  const [sensorType, setSensorType] = useState("Sensor");

  // ── popover state ─────────────────────────────────────────────────────────
  const [anchorEl, setAnchorEl] = useState(null);
  const [editingDate, setEditingDate] = useState(null); // "start" | "end"

  const handleOpenPicker = (event, which) => {
    setAnchorEl(event.currentTarget);
    setEditingDate(which);
  };

  const handleClosePicker = () => {
    setAnchorEl(null);
    setEditingDate(null);
  };

  // ── calendar onChange — delegate to parent's windowed handlers then close ──
  const handleCalendarChange = (v) => {
    if (!v || !v.isValid()) return;
    if (editingDate === "start") onStartDateChange(v);
    else onEndDateChange(v);
    handleClosePicker();
  };

  // ── sensor metadata ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadSensorMeta() {
      try {
        const meta = await fetchSensorMeta(sensorId);
        if (!cancelled && meta?.sensor_type) setSensorType(meta.sensor_type);
      } catch {
        if (!cancelled) setSensorType("Sensor");
      }
    }
    if (sensorId) loadSensorMeta();
    return () => { cancelled = true; };
  }, [sensorId]);

  // ── readings fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        setReadings(null);
        setWeatherReadings(null);

        if (!startDate || !endDate) {
          setReadings([]);
          if (showLocalWeather) setWeatherReadings([]);
          return;
        }

        const safeStart = startDate.isAfter(endDate) ? endDate : startDate;
        const safeEnd   = endDate.isBefore(startDate) ? startDate : endDate;
        const startISO  = safeStart.startOf("day").toISOString();
        const endISO    = safeEnd.endOf("day").toISOString();

        const data = await fetchSensorReadingsByRange(sensorId, startISO, endISO);

        if (data && data.length > 0) {
          const latestTen = [...data]
            .sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf())
            .slice(0, 10)
            .map((r) => ({
              ...r,
              timestamp: dayjs(r.timestamp).format("MM/DD/YYYY h:mm:ss A"),
            }));
          console.log(`%c Latest 10 Readings for Sensor ${sensorId}:`, "color: #FE9805; font-weight: bold;");
          console.table(latestTen);
        }

        if (!cancelled) setReadings(data);

        if (showLocalWeather) {
          // Weather data is fetched regardless; effectiveShowWeather controls rendering
          const weatherData = await fetchWeatherByRange(startISO, endISO);
          if (!cancelled) setWeatherReadings(weatherData);
        } else {
          if (!cancelled) setWeatherReadings(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load readings");
          setReadings([]);
          if (showLocalWeather) setWeatherReadings([]);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sensorId, startDate, endDate, showLocalWeather]);

  // ── chart data (daily buckets) ────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (readings === null) return null;
    if (!startDate || !endDate) return { xData: [], yData: [], weatherYData: [], unit: "" };

    const safeStart = startDate.isAfter(endDate) ? endDate : startDate;
    const safeEnd   = endDate.isBefore(startDate) ? startDate : endDate;

    const dayKeys = [];
    let cursor = safeStart.startOf("day");
    const last  = safeEnd.startOf("day");
    while (cursor.isBefore(last) || cursor.isSame(last, "day")) {
      dayKeys.push(cursor.format("YYYY-MM-DD"));
      cursor = cursor.add(1, "day");
    }

    const buckets = new Map();
    for (const r of readings) {
      const key = dayjs(r.timestamp).utc().format("YYYY-MM-DD");
      const val = Number(r.value);
      if (!Number.isFinite(val)) continue;
      const existing = buckets.get(key) ?? { sum: 0, count: 0 };
      existing.sum += val;
      existing.count += 1;
      buckets.set(key, existing);
    }

    const xData = dayKeys.map((k) => dayjs(k).toDate());
    const yData = dayKeys.map((k) => {
      const b = buckets.get(k);
      if (!b || b.count === 0) return null;
      return Math.round((b.sum / b.count) * 100) / 100;
    });

    const unit = readings.find((r) => r.unit)?.unit ?? "?";

    let weatherYData = dayKeys.map(() => null);
    const showWeatherInChart = showLocalWeather && sensorType.toLowerCase().includes("temperature");
    if (showWeatherInChart && weatherReadings) {
      const weatherMap = new Map(weatherReadings.map((w) => [w.day, w.avg_temp]));
      weatherYData = dayKeys.map((k) => weatherMap.get(k) ?? null);
    }

    return { xData, yData, weatherYData, unit };
  }, [readings, weatherReadings, startDate, endDate, showLocalWeather, sensorType]);

  // ── stats from raw readings ───────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!readings || readings.length === 0) return { high: null, low: null, avg: null };
    const values = readings.map((r) => Number(r.value)).filter((v) => Number.isFinite(v));
    if (values.length === 0) return { high: null, low: null, avg: null };
    const high = Math.max(...values);
    const low  = Math.min(...values);
    const avg  = values.reduce((s, v) => s + v, 0) / values.length;
    return { high, low, avg };
  }, [readings]);

  // Only show weather overlay for temperature sensors
  const isTemp = sensorType.toLowerCase().includes("temperature");
  const effectiveShowWeather = showLocalWeather && isTemp;

  const isReady =
    chartData &&
    chartData.xData.length > 0 &&
    chartData.yData.length === chartData.xData.length &&
    (!effectiveShowWeather ||
      (chartData.weatherYData && chartData.weatherYData.length === chartData.xData.length));

  const calendarValue = editingDate === "start" ? startDate : endDate;

  // ─────────────────────────────────────────────────────────────────────────
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

        {/* ── Card title — dates are clickable/underlined ── */}
        <Typography variant="h3" align="center" sx={{ mb: 1.5 }}>
          Data Averages from{" "}
          <DateSpan value={startDate} onClick={(e) => handleOpenPicker(e, "start")} />
          {" "}to{" "}
          <DateSpan value={endDate}   onClick={(e) => handleOpenPicker(e, "end")} />
        </Typography>

        {/* ── Date-picker popover ── */}
        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClosePicker}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          transformOrigin={{ vertical: "top", horizontal: "center" }}
          slotProps={{ paper: { sx: { mt: 0.5 } } }}
        >
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateCalendar
              value={calendarValue ?? null}
              onChange={handleCalendarChange}
              disableFuture
            />
          </LocalizationProvider>
        </Popover>

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
                  onClick={() => { if (canClick) onSensorChange(opt.id); }}
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
        ) : chartData && chartData.xData.length === 0 ? (
          <Typography>No readings found for this date range.</Typography>
        ) : !isReady ? (
          <Typography>Preparing chart…</Typography>
        ) : (
          <>
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
                    label: "Days",
                    valueFormatter: (value) =>
                      value == null ? "NaN" : dayjs(value).format("MMM D"),
                  },
                ]}
                yAxis={[
                  {
                    label: chartData.unit || "",
                    valueFormatter: (value) =>
                      value == null ? "NaN" : value.toFixed(2),
                  },
                ]}
                series={[
                  {
                    id: "hive",
                    data: chartData.yData,
                    label: `Hive ${sensorType} (${chartData.unit})`,
                    valueFormatter: (value) =>
                      value == null ? "NaN" : value.toFixed(2),
                    color: "#FE9805",
                  },
                  ...(effectiveShowWeather
                    ? [
                        {
                          id: "weather",
                          data: chartData.weatherYData,
                          label: "Local Weather (°C)",
                          valueFormatter: (value) =>
                            value == null ? "NaN" : value.toFixed(2),
                          color: "#FE5C05",
                        },
                      ]
                    : []),
                ]}
                height={300}
              />
            </div>

            {/* ── Stat boxes ── */}
            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <StatBox label="Highest Value" value={stats.high} unit={chartData.unit} />
              <StatBox label="Lowest Value"  value={stats.low}  unit={chartData.unit} />
              <StatBox label="Average Value" value={stats.avg}  unit={chartData.unit} />
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}
