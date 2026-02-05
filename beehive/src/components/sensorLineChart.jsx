import { useEffect, useMemo, useState } from "react";
import { LineChart } from "@mui/x-charts";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

import { fetchSensorReadingsByRange, fetchSensorMeta } from "../api/sensorReadings";
import { fetchWeatherByRange } from "../api/weather"; // NEW

export default function SensorLineChart({ sensorId, showLocalWeather = false }) {
  const WINDOW_DAYS = 14;

  const defaultEnd = useMemo(() => dayjs(), []);
  const defaultStart = useMemo(() => dayjs().subtract(WINDOW_DAYS, "day"), []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const [readings, setReadings] = useState(null);
  const [weatherReadings, setWeatherReadings] = useState(null); // NEW
  const [error, setError] = useState(null);

  const [sensorType, setSensorType] = useState("Sensor");

  const resetToDefaultWindow = () => {
    const end = dayjs();
    const start = end.subtract(WINDOW_DAYS, "day");
    setStartDate(start);
    setEndDate(end);
  };

  const handleStartChange = (v) => {
    if (!v || !v.isValid()) return;

    const proposedEnd = v.add(WINDOW_DAYS, "day");
    const today = dayjs();

    if (proposedEnd.isAfter(today, "day")) {
      resetToDefaultWindow();
      return;
    }

    setStartDate(v);
    setEndDate(proposedEnd);
  };

  const handleEndChange = (v) => {
    if (!v || !v.isValid()) return;

    const today = dayjs();
    const safeEnd = v.isAfter(today, "day") ? today : v;
    const proposedStart = safeEnd.subtract(WINDOW_DAYS, "day");

    setEndDate(safeEnd);
    setStartDate(proposedStart);
  };

  // Fetch sensor meta
  useEffect(() => {
    let cancelled = false;

    async function loadSensorMeta() {
      try {
        const meta = await fetchSensorMeta(sensorId);
        if (!cancelled && meta?.sensor_type) setSensorType(meta.sensor_type);
      } catch (e) {
        if (!cancelled) setSensorType("Sensor");
      }
    }

    if (sensorId) loadSensorMeta();
    return () => { cancelled = true; };
  }, [sensorId]);

  // Fetch readings AND weather
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        setReadings(null);
        setWeatherReadings(null); // NEW

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
    return () => { cancelled = true; };
  }, [sensorId, startDate, endDate, showLocalWeather]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (readings === null) return null;

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

    // Prepare weather data if available
    let weatherYData = null;
    if (showLocalWeather && weatherReadings) {
      const weatherBuckets = new Map();
      for (const w of weatherReadings) {
        const key = dayjs(w.timestamp).format("YYYY-MM-DD");
        const val = Number(w.temperature);
        const existing = weatherBuckets.get(key) ?? { sum: 0, count: 0 };
        existing.sum += val;
        existing.count += 1;
        weatherBuckets.set(key, existing);
      }

      weatherYData = dayKeys.map((k) => {
        const b = weatherBuckets.get(k);
        if (!b || b.count === 0) return null;
        return Math.round((b.sum / b.count) * 100) / 100;
      });
    }

    return { xData, yData, weatherYData, unit };
  }, [readings, weatherReadings, startDate, endDate, showLocalWeather]);

  return (
    <Card>
      <CardContent>
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
        ) : (
          chartData && (
            <LineChart
              legend={{ hidden: false }}
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
                  data: chartData.yData,
                  label: `Hive ${sensorType} (${chartData.unit})`,
                  valueFormatter: (value) =>
                    value == null ? "NaN" : value.toFixed(2),
                  color: "orange",
                },
                showLocalWeather && chartData.weatherYData
                  ? {
                      data: chartData.weatherYData,
                      label: `Local Weather (${chartData.unit})`,
                      valueFormatter: (value) =>
                        value == null ? "NaN" : value.toFixed(2),
                      color: "blue",
                    }
                  : null,
              ].filter(Boolean)}
              height={300}
            />

          )
        )}
      </CardContent>
    </Card>
  );
}
