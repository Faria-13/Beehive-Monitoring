import { useEffect, useMemo, useState } from "react";
import { LineChart } from "@mui/x-charts";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";

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

        const startISO = startDate.startOf("day").toISOString();
        const endISO = endDate.endOf("day").toISOString();

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
        ) : readings.length === 0 ? (
          <Typography>No readings found for this date range.</Typography>
        ) : (
          (() => {
            const unit = readings.find((r) => r.unit)?.unit ?? "?";
            const xData = readings.map((r) => new Date(r.timestamp));
            const yData = readings.map((r) => Number(r.value));

            return (
              <LineChart
                xAxis={[
                  {
                    data: xData,
                    scaleType: "time",
                    label: "Time",
                  },
                ]}
                series={[
                  {
                    data: yData,
                    label: `Temperature (${unit})`,
                  },
                ]}
                height={300}
              />
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}
