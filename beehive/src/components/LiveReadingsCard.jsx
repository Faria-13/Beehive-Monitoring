import { useEffect, useState, useCallback } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import dayjs from "dayjs";

import { fetchLatestSensorReading, fetchSensorMeta } from "../api/sensorReadings";

const STALE_MINUTES = 20;
const POLL_INTERVAL_MS = 60_000; // re-fetch every 60 s

export default function LiveReadingsCard({ sensorIds = [], sensorOptions = [] }) {
  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState(null);

  const labelFor = (id) =>
    sensorOptions.find((o) => o.id === id)?.label ?? `Sensor ${id}`;

  const load = useCallback(async () => {
    if (sensorIds.length === 0) {
      setRows([]);
      return;
    }

    try {
      setError(null);

      const results = await Promise.all(
        sensorIds.map(async (id) => {
          const [meta, reading] = await Promise.all([
            fetchSensorMeta(id).catch(() => null),
            fetchLatestSensorReading(id).catch(() => null),
          ]);

          const sensorType = meta?.sensor_type ?? labelFor(id);

          if (!reading) {
            return { id, sensorType, value: null, unit: null, stale: true };
          }

          const ageMinutes = dayjs().diff(dayjs(reading.timestamp), "minute");
          const stale = ageMinutes > STALE_MINUTES;

          return {
            id,
            sensorType,
            value: Number.isFinite(Number(reading.value))
              ? Math.round(Number(reading.value) * 100) / 100
              : null,
            unit: reading.unit ?? "",
            stale,
            timestamp: reading.timestamp,
          };
        })
      );

      results.sort((a, b) => a.sensorType.localeCompare(b.sensorType));
      setRows(results);
    } catch (e) {
      setError(e?.message ?? "Failed to load live readings");
      setRows([]);
    }
  }, [sensorIds]);

  // Initial load + polling
  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <Card
      sx={{
        backgroundColor: "var(--bg)",
        border: "2px solid var(--outline)",
        boxShadow: "none",
        height: "100%",
      }}
    >
      <CardContent
        sx={{
          backgroundColor: "var(--bg)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          pt: 3,
          px: "25px",
        }}
      >
        <Typography variant="h3" align="center" sx={{ mb: 4 }}>
          Current Sensor Readings
        </Typography>


        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            Error: {error}
          </Typography>
        )}

        {rows === null ? (
          <Typography>Loading…</Typography>
        ) : rows.length === 0 ? (
          <Typography>No sensors configured.</Typography>
        ) : (
          <Stack sx={{ flex: 1, justifyContent: "space-between", pb: "20px" }}>
            {rows.map((r) => (
              <Stack
                key={r.id}
                direction="row"
                alignItems="baseline"
                sx={{
                  width: "100%",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Typography variant="body1" sx={{ pr: 2, flexShrink: 0 }}>
                  {r.sensorType}:
                </Typography>

                <Typography
                  variant="body1"
                  sx={{
                    textAlign: "right",
                    color: r.stale ? "text.disabled" : "text.primary",
                    fontStyle: r.stale ? "italic" : "normal",
                  }}
                >
                  {r.stale || r.value === null
                    ? "no data"
                    : `${r.value}${r.unit}`}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
