import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../createClient";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import AdminNavBar from "../components/AdminNavBar";
import SensorDashboardRow from "../components/SensorDashboardRow";
import LiveReadingsCard from "../components/LiveReadingsCard";
import HourlyLineChart from "../components/HourlyLineChart";
import WeatherWidget from "../components/WeatherWidget";
import HiveStatusCard from "../components/HiveStatusCard";
import Footer from "../components/Footer";

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

// ── collapsible section for mobile ───────────────────────────────────────────
function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box sx={{ border: "2px solid var(--outline)", borderRadius: 1, overflow: "hidden" }}>
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
          cursor: "pointer",
          backgroundColor: "var(--bg)",
          userSelect: "none",
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
          {title}
        </Typography>
        <IconButton
          size="small"
          disableRipple
          sx={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s",
            color: "text.primary",
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ p: 2, backgroundColor: "var(--bg)" }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminHiveDashboard() {
  const { hiveId } = useParams();
  const navigate   = useNavigate();
  const theme      = useTheme();
  const isMobile   = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet   = useMediaQuery(theme.breakpoints.between("sm", "md"));

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
        <AdminNavBar />
        <Box sx={{ p: 3 }}>Loading hive dashboard…</Box>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AdminNavBar />
        <Box sx={{ p: 3 }}>
          <Typography color="error">Error: {error}</Typography>
        </Box>
      </>
    );
  }

  if (!hive) {
    return (
      <>
        <AdminNavBar />
        <Box sx={{ p: 3 }}>
          <Typography>Hive not found.</Typography>
        </Box>
      </>
    );
  }

  if (sensors.length === 0) {
    return (
      <>
        <AdminNavBar />
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

  const hiveName = hive.hive_code || `Hive ${hive.hive_id}`;

  // ── mobile layout ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <AdminNavBar centerTitle={hiveName} />
        <Box sx={{ px: 2, pt: 1.5, pb: 2, maxWidth: 600, mx: "auto" }}>

          <Box sx={{ mb: 2 }}>
            <HiveStatusCard hiveId={Number(hiveId)} />
          </Box>

          <Box sx={{ mb: 2 }}>
            <CollapsibleSection title="Your Hive Live">
              <Stack spacing={2}>
                <LiveReadingsCard sensorIds={sensorIds} sensorOptions={sensorOptions} />
                <HourlyLineChart
                  sensorId={liveActiveSensorId}
                  sensorOptions={sensorOptions}
                  onSensorChange={setLiveActiveSensorId}
                />
                <WeatherWidget />
              </Stack>
            </CollapsibleSection>
          </Box>

          <Box sx={{ mb: 2 }}>
            <CollapsibleSection title="2 Week View">
              <SensorDashboardRow
                selectedSensorId={selectedSensorId}
                onSelectedSensorIdChange={setSelectedSensorId}
                sensorIds={sensorIds}
                sensorOptions={sensorOptions}
                showLocalWeather={true}
              />
            </CollapsibleSection>
          </Box>

        </Box>
        <Footer />
      </>
    );
  }

  // ── tablet layout (sm: 600–899px) ────────────────────────────────────────
  if (isTablet) {
    return (
      <>
        <AdminNavBar centerTitle={hiveName} />
        <Box sx={{ px: 3, pt: 2, pb: 2, mx: "auto" }}>

          <SectionHeader>Your Hive Live</SectionHeader>

          <Stack spacing={2} sx={{ mb: 4 }}>
            <LiveReadingsCard sensorIds={sensorIds} sensorOptions={sensorOptions} />
            <HourlyLineChart
              sensorId={liveActiveSensorId}
              sensorOptions={sensorOptions}
              onSensorChange={setLiveActiveSensorId}
            />
            <Stack direction="row" spacing={2} alignItems="stretch">
              <Box sx={{ flex: 1 }}>
                <WeatherWidget />
              </Box>
              <Box sx={{ flex: 1 }}>
                <HiveStatusCard hiveId={Number(hiveId)} />
              </Box>
            </Stack>
          </Stack>

          <SectionHeader>2 Week View</SectionHeader>
          <SensorDashboardRow
            selectedSensorId={selectedSensorId}
            onSelectedSensorIdChange={setSelectedSensorId}
            sensorIds={sensorIds}
            sensorOptions={sensorOptions}
            showLocalWeather={true}
          />

          <Box sx={{ pb: "50px" }} />
        </Box>
        <Footer />
      </>
    );
  }

  // ── desktop layout (md+) ──────────────────────────────────────────────────
  return (
    <>
      <AdminNavBar centerTitle={hiveName} />

      <Box sx={{ px: "50px", pt: "24px", pb: 2, maxWidth: 1400, mx: "auto" }}>

        <SectionHeader>Your Hive Live</SectionHeader>

        <Stack
          direction="row"
          spacing={2}
          alignItems="stretch"
          sx={{ mb: 4 }}
        >
          <Box sx={{ width: "25%", flexShrink: 0, minWidth: 220 }}>
            <LiveReadingsCard sensorIds={sensorIds} sensorOptions={sensorOptions} />
          </Box>

          <Box sx={{ width: "50%", minWidth: 320 }}>
            <HourlyLineChart
              sensorId={liveActiveSensorId}
              sensorOptions={sensorOptions}
              onSensorChange={setLiveActiveSensorId}
            />
          </Box>

          <Box
            sx={{
              width: "25%",
              flexShrink: 0,
              minWidth: 200,
              alignSelf: "stretch",
              display: "grid",
              gridTemplateRows: "270px 1fr",
              gap: 2,
            }}
          >
            <WeatherWidget />
            <HiveStatusCard hiveId={Number(hiveId)} />
          </Box>
        </Stack>

        <SectionHeader>2 Week View</SectionHeader>

        <SensorDashboardRow
          selectedSensorId={selectedSensorId}
          onSelectedSensorIdChange={setSelectedSensorId}
          sensorIds={sensorIds}
          sensorOptions={sensorOptions}
          showLocalWeather={true}
        />

        <Box sx={{ pb: "50px" }} />
      </Box>
      <Footer />
    </>
  );
}
