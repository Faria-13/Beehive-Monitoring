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
import { fetchWeatherByRange } from "../api/weather";

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
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!readings) return null;

    // Sensor data
    const xData = readings.map(r => new Date(r.timestamp));
    const yData = readings.map(r => Number(r.value));

    // Weather data
    let weatherYData = [];
    if (showLocalWeather && weatherReadings) {
      weatherYData = weatherReadings.map(w => Number(w.temp_c));
    }

    const unit = readings.find(r => r.unit)?.unit ?? "?";

    return { xData, yData, weatherYData, unit };
  }, [readings, weatherReadings, showLocalWeather]);

  const isReady =
  chartData &&
  chartData.xData.length > 0 &&
  chartData.yData.length === chartData.xData.length &&
  (!showLocalWeather ||
    (chartData.weatherYData &&
      chartData.weatherYData.length === chartData.xData.length));

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
        ) : !isReady ? (
            <Typography>Preparing chart…</Typography>
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
                  id: "hive",
                  data: chartData.yData,
                  label: `Hive ${sensorType} (${chartData.unit})`,
                  valueFormatter: (value) =>
                    value == null ? "NaN" : value.toFixed(2),
                  color: "orange",
                },
                {
                  id: "weather",
                  data: showLocalWeather ? chartData.weatherYData : chartData.weatherYData.map(() => null),
                  label: "Local Weather (°C)",
                  valueFormatter: (value) =>
                    value == null ? "NaN" : value.toFixed(2),
                  color: "blue",
                },
              ]}
              height={300}
            />

          )
        )}
      </CardContent>
    </Card>
  );
}
