import { useEffect, useMemo, useState } from "react";
import { LineChart } from "@mui/x-charts";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

import { fetchSensorReadingsByRange, fetchSensorMeta } from "../api/sensorReadings";
import { fetchWeatherByRange } from "../api/weather";

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
  const WINDOW_DAYS = 14;

  const [readings, setReadings] = useState(null);
  const [weatherReadings, setWeatherReadings] = useState(null);
  const [error, setError] = useState(null);
  const [sensorType, setSensorType] = useState("Sensor");

  const resetToDefaultWindow = () => {
    const end = dayjs();
    const start = end.subtract(WINDOW_DAYS, "day");
    onStartDateChange(start);
    onEndDateChange(end);
  };

  const handleStartChange = (v) => {
    if (!v || !v.isValid()) return;

    const proposedEnd = v.add(WINDOW_DAYS, "day");
    const today = dayjs();

    if (proposedEnd.isAfter(today, "day")) {
      resetToDefaultWindow();
      return;
    }

    onStartDateChange(v);
    onEndDateChange(proposedEnd);
  };

  const handleEndChange = (v) => {
    if (!v || !v.isValid()) return;

    const today = dayjs();
    const safeEnd = v.isAfter(today, "day") ? today : v;
    const proposedStart = safeEnd.subtract(WINDOW_DAYS, "day");

    onEndDateChange(safeEnd);
    onStartDateChange(proposedStart);
  };

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
    return () => {
      cancelled = true;
    };
  }, [sensorId]);

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
        const safeEnd = endDate.isBefore(startDate) ? startDate : endDate;

        const startISO = safeStart.startOf("day").toISOString();
        const endISO = safeEnd.endOf("day").toISOString();

        const data = await fetchSensorReadingsByRange(sensorId, startISO, endISO);
        if (!cancelled) setReadings(data);

        if (showLocalWeather) {
          const weatherData = await fetchWeatherByRange(startISO, endISO);
          if (!cancelled) setWeatherReadings(weatherData);
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
    return () => {
      cancelled = true;
    };
  }, [sensorId, startDate, endDate, showLocalWeather]);

  const chartData = useMemo(() => {
    if (readings === null) return null;
    if (!startDate || !endDate) return { xData: [], yData: [], weatherYData: [], unit: "" };

    const safeStart = startDate.isAfter(endDate) ? endDate : startDate;
    const safeEnd = endDate.isBefore(startDate) ? startDate : endDate;

    const dayKeys = [];
    let cursor = safeStart.startOf("day");
    const last = safeEnd.startOf("day");
    while (cursor.isBefore(last) || cursor.isSame(last, "day")) {
      dayKeys.push(cursor.format("YYYY-MM-DD"));
      cursor = cursor.add(1, "day");
    }

    const buckets = new Map();
    for (const r of readings) {
      const key = dayjs(r.timestamp).format("YYYY-MM-DD");
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
    if (showLocalWeather && weatherReadings) {
      const weatherMap = new Map();
      for (const w of weatherReadings) {
        // const key = dayjs(w.timestamp).format("YYYY-MM-DD");
        const key = dayjs(w.timestamp).local().format("YYYY-MM-DD");
        const val = Number(w.avg_temp);
        if (!Number.isFinite(val)) continue;
        // const existing = weatherBuckets.get(key) ?? { sum: 0, count: 0 };
        // existing.sum += val;
        // existing.count += 1;
        // weatherBuckets.set(key, existing);
          weatherMap.set(key, val);
      }

      // weatherYData = dayKeys.map((k) => {
      //   const b = weatherBuckets.get(k);
      //   if (!b || b.count === 0) return null;
      //   return Math.round((b.sum / b.count) * 100) / 100;
      // });
        weatherYData = dayKeys.map(k => weatherMap.get(k) ?? null);
    }

    return { xData, yData, weatherYData, unit };
  }, [readings, weatherReadings, startDate, endDate, showLocalWeather]);

  const isReady =
    chartData &&
    chartData.xData.length > 0 &&
    chartData.yData.length === chartData.xData.length &&
    (!showLocalWeather ||
      (chartData.weatherYData && chartData.weatherYData.length === chartData.xData.length));

  return (
    <Card
      sx={{
        backgroundColor: "var(--bg)",
        border: "2px solid var(--outline)",
        boxShadow: "none",
        height: "100%",
      }}
    >
      <CardContent sx={{ backgroundColor: "var(--bg)" }}>
        {sensorOptions.length > 0 && (
          <Stack
            direction="row"
            spacing={3}
            justifyContent="center"
            alignItems="center"
            sx={{ mb: 1, flexWrap: "wrap" }}
          >
            {sensorOptions.map((opt) => {
              const isActive = opt.id === sensorId;
              const canClick = typeof onSensorChange === "function";

              return (
                <Button
                  key={opt.id}
                  variant="text"
                  disableRipple
                  onClick={() => {
                    if (canClick) onSensorChange(opt.id);
                  }}
                  sx={{
                    textTransform: "none",
                    minWidth: 0,
                    px: 0.5,
                    py: 0.25,
                    fontWeight: isActive ? 700 : 400,
                    textDecoration: isActive ? "underline" : "none",
                    textUnderlineOffset: "6px",
                    opacity: canClick || isActive ? 1 : 0.6,
                  }}
                >
                  {opt.label}
                </Button>
              );
            })}
          </Stack>
        )}

        <Typography variant="h6" gutterBottom>
          {sensorType} Sensor (ID: {sensorId})
        </Typography>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
            <DatePicker
              label="Start date"
              value={startDate}
              onChange={handleStartChange}
              disableFuture
              maxDate={dayjs().subtract(WINDOW_DAYS, "day")}
              slotProps={{ textField: { size: "small" } }}
            />
            <DatePicker
              label="End date"
              value={endDate}
              onChange={handleEndChange}
              disableFuture
              maxDate={dayjs()}
              slotProps={{ textField: { size: "small" } }}
            />
          </Stack>
        </LocalizationProvider>

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
                  valueFormatter: (value) => (value == null ? "NaN" : dayjs(value).format("MMM D")),
                },
              ]}
              yAxis={[
                {
                  label: chartData.unit || "",
                  valueFormatter: (value) => (value == null ? "NaN" : value.toFixed(2)),
                },
              ]}
              series={[
                {
                  id: "hive",
                  data: chartData.yData,
                  label: `Hive ${sensorType} (${chartData.unit})`,
                  valueFormatter: (value) => (value == null ? "NaN" : value.toFixed(2)),
                  color: "#FE9805",
                },
                {
                  id: "weather",
                  data: showLocalWeather ? chartData.weatherYData : chartData.weatherYData.map(() => null),
                  label: "Local Weather (°C)",
                  valueFormatter: (value) => (value == null ? "NaN" : value.toFixed(2)),
                  color: "#FE5C05",
                },
              ]}
              height={300}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
