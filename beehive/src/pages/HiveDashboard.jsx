import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../createClient";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";

import { NavBar } from "../components/HiveOverviewUI";
import SensorDashboardRow from "../components/SensorDashboardRow";
import LiveReadingsCard from "../components/LiveReadingsCard";
import HourlyLineChart from "../components/HourlyLineChart";
import WeatherWidget from "../components/WeatherWidget";

// ── shared section header ─────────────────────────────────────────────────────
function SectionHeader({ children }) {
  return (
    <Typography
      variant="h5"
      sx={{ fontWeight: 700, mb: 1.5, color: "text.primary" }}
    >
      {children}
    </Typography>
  );
}

// ── placeholder card for future content ──────────────────────────────────────
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
export default function HiveDashboard() {
  const { hiveId } = useParams();
  const navigate   = useNavigate();

  const [hive,              setHive]              = useState(null);
  const [sensors,           setSensors]           = useState([]);
  const [selectedSensorId,  setSelectedSensorId]  = useState(null);
  const [liveActiveSensorId, setLiveActiveSensorId] = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState(null);

  useEffect(() => {
    if (!hiveId) return;

    async function loadHiveDashboard() {
      try {
        setLoading(true);
        setError(null);

        const { data: hiveData, error: hiveError } = await supabase
          .from("beehives")
          .select("*")
          .eq("hive_id", hiveId)
          .single();

        if (hiveError) throw hiveError;
        setHive(hiveData);

        const { data: boards, error: boardsError } = await supabase
          .from("iot_boards")
          .select("board_id")
          .eq("hive_id", hiveId);

        if (boardsError) throw boardsError;

        const boardIds = (boards ?? []).map((b) => b.board_id);

        if (boardIds.length === 0) {
          setSensors([]);
          setSelectedSensorId(null);
          setLiveActiveSensorId(null);
          return;
        }

        const { data: sensorData, error: sensorsError } = await supabase
          .from("sensors")
          .select("sensor_id, board_id, sensor_type, unit, status")
          .in("board_id", boardIds)
          .order("sensor_id", { ascending: true });

        if (sensorsError) throw sensorsError;

        const safeSensors = sensorData ?? [];
        setSensors(safeSensors);
        setSelectedSensorId(safeSensors[0]?.sensor_id ?? null);
        setLiveActiveSensorId(safeSensors[0]?.sensor_id ?? null);
      } catch (e) {
        setError(e.message || "Failed to load hive dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadHiveDashboard();
  }, [hiveId]);

  const sensorOptions = useMemo(
    () => sensors.map((s) => ({ id: s.sensor_id, label: s.sensor_type || `Sensor ${s.sensor_id}` })),
    [sensors]
  );

  const sensorIds = useMemo(
    () => sensors.map((s) => s.sensor_id),
    [sensors]
  );

  // ── loading / error / empty states ───────────────────────────────────────
  if (loading) {
    return (
      <>
        <NavBar onDatabaseClick={() => navigate(`/database?hive=${hiveId}`)} />
        <Box sx={{ p: 3 }}>Loading hive dashboard…</Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <NavBar onDatabaseClick={() => navigate(`/database?hive=${hiveId}`)} />
        <Box sx={{ p: 3 }}>
          <Typography color="error">Error: {error}</Typography>
        </Box>
      </>
    );
  }

  if (!hive) {
    return (
      <>
        <NavBar onDatabaseClick={() => navigate(`/database?hive=${hiveId}`)} />
        <Box sx={{ p: 3 }}>
          <Typography>Hive not found.</Typography>
        </Box>
      </>
    );
  }

  if (sensors.length === 0) {
    return (
      <>
        <NavBar onDatabaseClick={() => navigate(`/database?hive=${hiveId}`)} />
        <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h4">
              {hive.hive_code || `Hive ${hive.hive_id}`}
            </Typography>
            <Typography>No sensors found for this hive.</Typography>
          </Stack>
        </Box>
      </>
    );
  }

  // ── main dashboard ────────────────────────────────────────────────────────
  return (
    <>
      <NavBar onDatabaseClick={() => navigate(`/database?hive=${hiveId}`)} />

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

          {/* Right column: weather + placeholder */}
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
          selectedSensorId={selectedSensorId}
          onSelectedSensorIdChange={setSelectedSensorId}
          sensorIds={sensorIds}
          sensorOptions={sensorOptions}
          showLocalWeather={true}
        />

      </Box>
    </>
  );
}
