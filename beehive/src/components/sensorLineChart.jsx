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

import { fetchSensorReadingsByRange } from "../api/sensorReadings";

export default function SensorLineChart({ sensorId }) {
  const defaultEnd = useMemo(() => dayjs(), []);
  const defaultStart = useMemo(() => dayjs().subtract(14, "day"), []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const [readings, setReadings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        setReadings(null);
        if (!startDate || !endDate) {
          setReadings([]);
          return;
        }

        const safeStart = startDate.isAfter(endDate) ? endDate : startDate;
        const safeEnd = endDate.isBefore(startDate) ? startDate : endDate;

        const startISO = safeStart.startOf("day").toISOString();
        const endISO = safeEnd.endOf("day").toISOString();

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
    return () => {
      cancelled = true;
    };
  }, [sensorId, startDate, endDate]);

  const chartData = useMemo(() => {
    if (readings === null) return null;

    if (!startDate || !endDate) {
      return { xData: [], yData: [], unit: "?" };
    }

    const safeStart = startDate.isAfter(endDate) ? endDate : startDate;
    const safeEnd = endDate.isBefore(startDate) ? startDate : endDate;

    const unit = readings.find((r) => r.unit)?.unit ?? "?";

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
    console.log("dayKeys:", dayKeys);
    console.log("yData raw:", yData);
    console.log(
      "yData precision:",
      yData.map((v) => (v == null ? null : v.toString()))
    );


    return { xData, yData, unit };
  }, [readings, startDate, endDate]);
  

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Temperature Sensor (ID: {sensorId})
        </Typography>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
            <DatePicker
              label="Start date"
              value={startDate}
              onChange={(v) => setStartDate(v)}
              disableFuture
              slotProps={{ textField: { size: "small" } }}
            />
            <DatePicker
              label="End date"
              value={endDate}
              onChange={(v) => setEndDate(v)}
              disableFuture
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
              xAxis={[
                {
                  data: chartData.xData,
                  scaleType: "time",
                  label: "Days",
              
                  valueFormatter: (value) =>
                    value == null ? "NaN" : dayjs(value).format("MMM D"),
                },
              ]}
              series={[
                {
                  data: chartData.yData,
                  label: `Daily Avg Temperature (${chartData.unit})`,
                  valueFormatter: (value) =>
                    value == null ? "NaN" : value.toFixed(2),
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
