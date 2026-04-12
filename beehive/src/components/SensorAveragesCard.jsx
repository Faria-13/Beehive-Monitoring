import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import dayjs from "dayjs";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import { fetchSensorReadingsByRange, fetchSensorMeta } from "../api/sensorReadings";

// ── clickable underlined date span ────────────────────────────────────────────
function DateSpan({ value, onClick }) {
  return (
    <Box
      component="span"
      onClick={onClick}
      sx={{
        textDecoration: "underline",
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
export default function SensorAveragesCard({
  sensorIds = [],
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) {
  const [rows,  setRows]  = useState(null); // null = loading, [] = loaded
  const [error, setError] = useState(null);

  // ── popover state ─────────────────────────────────────────────────────────
  const [anchorEl,    setAnchorEl]    = useState(null);
  const [editingDate, setEditingDate] = useState(null); // "start" | "end"

  const handleOpenPicker = (event, which) => {
    setAnchorEl(event.currentTarget);
    setEditingDate(which);
  };

  const handleClosePicker = () => {
    setAnchorEl(null);
    setEditingDate(null);
  };

  // Delegate to the parent's windowed handlers, then close the popover
  const handleCalendarChange = (v) => {
    if (!v || !v.isValid()) return;
    if (editingDate === "start") onStartDateChange?.(v);
    else onEndDateChange?.(v);
    handleClosePicker();
  };

  // ── data load ─────────────────────────────────────────────────────────────
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
        const safeEnd   = dayjs(endDate).isBefore(dayjs(startDate)) ? dayjs(startDate) : dayjs(endDate);

        const startISO = safeStart.startOf("day").toISOString();
        const endISO   = safeEnd.endOf("day").toISOString();

        const results = await Promise.all(
          sensorIds.map(async (id) => {
            const [meta, readings] = await Promise.all([
              fetchSensorMeta(id).catch(() => null),
              fetchSensorReadingsByRange(id, startISO, endISO).catch(() => []),
            ]);

            const sensorType = meta?.sensor_type ?? `Sensor ${id}`;
            const unit = readings.find((r) => r.unit)?.unit ?? "";

            let sum = 0, count = 0;
            for (const r of readings) {
              const v = Number(r.value);
              if (Number.isFinite(v)) { sum += v; count += 1; }
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
    return () => { cancelled = true; };
  }, [sensorIds, startDate, endDate]);

  const calendarValue = editingDate === "start" ? startDate : endDate;

  // ── render ────────────────────────────────────────────────────────────────
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
          px: "25px",
        }}
      >
        {/* ── Header with clickable date range ── */}
        <Typography variant="h3" align="center" sx={{ mb: 4 }}>
          {onStartDateChange ? (
            <>
              Sensor Averages From{" "}
              <DateSpan value={startDate} onClick={(e) => handleOpenPicker(e, "start")} />
              {" "}to{" "}
              <DateSpan value={endDate}   onClick={(e) => handleOpenPicker(e, "end")} />
            </>
          ) : (
            <>
              Sensor Averages From{" "}
              {startDate ? dayjs(startDate).format("MM/DD") : "__/__"}
              {" "}to{" "}
              {endDate ? dayjs(endDate).format("MM/DD") : "__/__"}
            </>
          )}
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
          <Stack sx={{ flex: 1, justifyContent: "space-between", pb: "20px" }}>
            {rows.map((r) => (
              <Stack
                key={r.sensorId}
                direction="row"
                alignItems="baseline"
                sx={{ width: "100%", justifyContent: "space-between", gap: 2 }}
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
