import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";

import SensorDashboardRow from "../components/SensorDashboardRow";
import LiveReadingsCard from "../components/LiveReadingsCard";
import HourlyLineChart from "../components/HourlyLineChart";
import WeatherWidget from "../components/WeatherWidget";

const sensorOptions = [
  { id: 4,  label: "Temperature" },
  { id: 3,  label: "Humidity" },
  { id: 44, label: "Weight" },
  { id: 1,  label: "Carbon" },
  { id: 80, label: "Volume" },
];

const sensorIds = sensorOptions.map((s) => s.id);

// ── shared section-header style ───────────────────────────────────────────────
function SectionHeader({ children }) {
  return (
    <Typography
      variant="h5"
      sx={{
        fontWeight: 700,
        mb: 1.5,
        color: "text.primary",
      }}
    >
      {children}
    </Typography>
  );
}

// ── hollow placeholder card ───────────────────────────────────────────────────
function PlaceholderCard({ label }) {
  return (
    <Card
      sx={{
        backgroundColor: "var(--bg)",
        border: "2px dashed var(--outline)",
        boxShadow: "none",
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 120,
      }}
    >
      <CardContent>
        <Typography variant="h3" align="center">
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Temperature() {
  const [liveActiveSensorId, setLiveActiveSensorId] = useState(sensorOptions[0].id);

  return (
    <Box sx={{ px: 2, py: 2, maxWidth: 1400, mx: "auto" }}>

      {/* ── Row 1: Your Hive Live ── */}
      <SectionHeader>Your Hive Live</SectionHeader>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems="stretch"
        sx={{ mb: 4 }}
      >
        {/* Narrow: Current Sensor Readings */}
        <Box sx={{ width: { md: "25%" }, flexShrink: 0, minWidth: 220 }}>
          <LiveReadingsCard sensorIds={sensorIds} sensorOptions={sensorOptions} />
        </Box>

        {/* Middle: 24-Hour Chart */}
        <Box sx={{ width: { md: "50%" }, minWidth: 320 }}>
          <HourlyLineChart
            sensorId={liveActiveSensorId}
            sensorOptions={sensorOptions}
            onSensorChange={setLiveActiveSensorId}
          />
        </Box>

        {/* Right column: two placeholder boxes stacked */}
        <Stack
          direction="column"
          spacing={2}
          sx={{ width: { md: "25%" }, flexShrink: 0, minWidth: 200 }}
        >
          <WeatherWidget />
          <PlaceholderCard label="Current Status of Hive" />
        </Stack>
      </Stack>

      {/* ── Row 2: 2 Week View ── */}
      <SectionHeader>2 Week View</SectionHeader>

      <SensorDashboardRow
        selectedSensorId={4}
        sensorIds={sensorIds}
        sensorOptions={sensorOptions}
        showLocalWeather={true}
      />
    </Box>
  );
}
