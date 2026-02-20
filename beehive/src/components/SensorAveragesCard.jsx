import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import dayjs from "dayjs";

import { fetchSensorReadingsByRange, fetchSensorMeta } from "../api/sensorReadings";

export default function SensorAveragesCard({ sensorIds = [], startDate, endDate }) {
  const [rows, setRows] = useState(null); // null = loading, [] = loaded
  const [error, setError] = useState(null);

  const labelRange = useMemo(() => {
    const s = startDate ? dayjs(startDate).format("MM/DD") : "--/--";
    const e = endDate ? dayjs(endDate).format("MM/DD") : "--/--";
    return `${s} to ${e}`;
  }, [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        setRows(null);

        if (!startDate || !endDate || sensorIds.length === 0) {
          setRows([]);
          return;
        }

        const safeStart = dayjs(startDate).isAfter(dayjs(endDate)) ? dayjs(endDate) : dayjs(startDate);
        const safeEnd = dayjs(endDate).isBefore(dayjs(startDate)) ? dayjs(startDate) : dayjs(endDate);

        const startISO = safeStart.startOf("day").toISOString();
        const endISO = safeEnd.endOf("day").toISOString();

        const results = await Promise.all(
          sensorIds.map(async (id) => {
            const [meta, readings] = await Promise.all([
              fetchSensorMeta(id).catch(() => null),
              fetchSensorReadingsByRange(id, startISO, endISO).catch(() => []),
            ]);

            const sensorType = meta?.sensor_type ?? `Sensor ${id}`;
            const unit = readings.find((r) => r.unit)?.unit ?? "";

            let sum = 0;
            let count = 0;

            for (const r of readings) {
              const v = Number(r.value);
              if (Number.isFinite(v)) {
                sum += v;
                count += 1;
              }
            }

            const avg = count === 0 ? null : Math.round((sum / count) * 100) / 100;

            return { sensorId: id, sensorType, avg, unit, count };
          })
        );

        if (!cancelled) {
          results.sort((a, b) => a.sensorType.localeCompare(b.sensorType));
          setRows(results);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load sensor averages");
          setRows([]);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sensorIds, startDate, endDate]);

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
        }}
      >
        <Typography variant="h3" align="center" sx={{ mb: 4 }}>
          Sensor Averages From {labelRange}
        </Typography>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            Error: {error}
          </Typography>
        )}

        {rows === null ? (
          <Typography>Loading…</Typography>
        ) : rows.length === 0 ? (
          <Typography>No sensors or no date range selected.</Typography>
        ) : (
          <Stack sx={{ flex: 1, justifyContent: "space-between" }}>
            {rows.map((r) => (
              <Stack
                key={r.sensorId}
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

                <Typography variant="body1" sx={{ textAlign: "right" }}>
                  {r.avg === null ? "No data" : `${r.avg}${r.unit ?? ""}`}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
