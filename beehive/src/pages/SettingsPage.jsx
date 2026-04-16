import { useEffect, useState } from "react";
import { supabase } from "../createClient";
import { useAuth } from "../context/AuthContext";
import { NavBar } from "../components/HiveOverviewUI";
import Footer from "../components/Footer";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import BatteryChargingFullIcon from "@mui/icons-material/BatteryChargingFull";
import Battery20Icon from "@mui/icons-material/Battery20";
import Battery60Icon from "@mui/icons-material/Battery60";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBatterySensor(type) {
  return type?.toLowerCase().includes("battery");
}

function batteryColor(pct) {
  if (pct == null) return "#aaa";
  if (pct <= 20) return "#FF4D4D";
  if (pct <= 50) return "#FE9805";
  return "#4CAF50";
}

function BatteryIcon({ pct }) {
  if (pct == null) return <Battery20Icon sx={{ color: "#aaa", fontSize: 18 }} />;
  if (pct <= 20) return <Battery20Icon sx={{ color: "#FF4D4D", fontSize: 18 }} />;
  if (pct <= 60) return <Battery60Icon sx={{ color: "#FE9805", fontSize: 18 }} />;
  return <BatteryChargingFullIcon sx={{ color: "#4CAF50", fontSize: 18 }} />;
}

function StatusChip({ status }) {
  const s = status?.toLowerCase();
  const cfg =
    s === "active"   ? { label: "Active",   color: "#4CAF50", bg: "rgba(76,175,80,0.12)"  } :
    s === "inactive" ? { label: "Inactive", color: "#FF4D4D", bg: "rgba(255,77,77,0.12)"  } :
                       { label: status ?? "Unknown", color: "#888", bg: "rgba(0,0,0,0.06)" };

  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        bgcolor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
        fontWeight: 600,
        fontSize: 11,
        height: 22,
      }}
    />
  );
}

function HiveStatusChip({ status }) {
  const s = status?.toLowerCase();
  const cfg =
    s === "active"      ? { label: "Active",      color: "#4CAF50", bg: "rgba(76,175,80,0.12)"    } :
    s === "inactive"    ? { label: "Inactive",    color: "#FF4D4D", bg: "rgba(255,77,77,0.12)"    } :
    s === "maintenance" ? { label: "Maintenance", color: "#FE9805", bg: "rgba(254,152,5,0.12)"    } :
                          { label: status ?? "Unknown", color: "#888", bg: "rgba(0,0,0,0.06)"     };

  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        bgcolor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
        fontWeight: 700,
        fontSize: 12,
        height: 24,
      }}
    />
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }) {
  return (
    <Box mb={2}>
      <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize={{ xs: 20, md: 24 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography fontFamily="Inter, sans-serif" fontSize={13} color="text.secondary" mt={0.25}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

// ─── Sensor row ───────────────────────────────────────────────────────────────

function SensorRow({ sensor, isLast }) {
  const { sensor_type, sensor_id, unit, status, latestReading } = sensor;
  const isBattery = isBatterySensor(sensor_type);
  const battPct = isBattery && latestReading ? Number(latestReading.value) : null;

  const lastSeen = latestReading?.timestamp
    ? dayjs(latestReading.timestamp).fromNow()
    : "No data";

  const isStale =
    latestReading?.timestamp &&
    dayjs().diff(dayjs(latestReading.timestamp), "hour") > 2;

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "2fr 1fr 2fr 2fr" },
          gap: { xs: 1, sm: 2 },
          alignItems: "center",
          py: 1.5,
          px: { xs: 1.5, sm: 2 },
        }}
      >
        {/* Sensor type + ID */}
        <Stack direction="row" alignItems="center" spacing={1}>
          {isBattery && <BatteryIcon pct={battPct} />}
          <Box>
            <Typography fontFamily="Inter, sans-serif" fontWeight={600} fontSize={13} textTransform="capitalize">
              {sensor_type ?? "Unknown"}
            </Typography>
            <Typography fontFamily="Inter, sans-serif" fontSize={11} color="text.secondary">
              ID: {sensor_id}
            </Typography>
          </Box>
        </Stack>

        {/* Status */}
        <StatusChip status={status} />

        {/* Latest value */}
        <Box>
          {isBattery && battPct != null ? (
            <Stack spacing={0.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography fontFamily="Inter, sans-serif" fontWeight={600} fontSize={13} color={batteryColor(battPct)}>
                  {battPct.toFixed(1)}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(battPct, 100)}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "rgba(0,0,0,0.08)",
                  "& .MuiLinearProgress-bar": { bgcolor: batteryColor(battPct), borderRadius: 3 },
                }}
              />
            </Stack>
          ) : latestReading ? (
            <Typography fontFamily="Inter, sans-serif" fontWeight={600} fontSize={13}>
              {Number(latestReading.value).toFixed(2)}
              <Typography component="span" fontSize={11} color="text.secondary" ml={0.5}>
                {unit ?? latestReading.unit ?? ""}
              </Typography>
            </Typography>
          ) : (
            <Typography fontFamily="Inter, sans-serif" fontSize={12} color="text.secondary">—</Typography>
          )}
        </Box>

        {/* Last updated */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {isStale ? (
            <Tooltip title="No recent data — sensor may be offline">
              <WifiOffIcon sx={{ fontSize: 14, color: "#FF4D4D" }} />
            </Tooltip>
          ) : latestReading ? (
            <CheckCircleIcon sx={{ fontSize: 14, color: "#4CAF50" }} />
          ) : (
            <ErrorIcon sx={{ fontSize: 14, color: "#aaa" }} />
          )}
          <Typography fontFamily="Inter, sans-serif" fontSize={12} color={isStale ? "#FF4D4D" : "text.secondary"}>
            {lastSeen}
          </Typography>
        </Stack>
      </Box>
      {!isLast && <Divider />}
    </>
  );
}

// ─── Hive sensor card ─────────────────────────────────────────────────────────

function HiveSensorCard({ hive, sensors }) {
  const overallHealthy = sensors.every(
    (s) => s.status?.toLowerCase() === "active" || s.status == null
  );
  const hasStale = sensors.some(
    (s) => s.latestReading?.timestamp &&
      dayjs().diff(dayjs(s.latestReading.timestamp), "hour") > 2
  );

  const batterySensor = sensors.find((s) => isBatterySensor(s.sensor_type));
  const battPct = batterySensor?.latestReading ? Number(batterySensor.latestReading.value) : null;

  return (
    <Paper
      variant="outlined"
      sx={{
        border: "2px solid black",
        borderRadius: "11px",
        overflow: "hidden",
        bgcolor: "#fff9e9",
      }}
    >
      {/* Hive header */}
      <Box
        sx={{
          bgcolor: "#fbc139",
          px: { xs: 1.5, sm: 2.5 },
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize={16}>
            {hive.hive_code || `Hive ${hive.hive_id}`}
          </Typography>
          <HiveStatusChip status={hive.hive_status} />
        </Stack>

        <Stack direction="row" alignItems="center" spacing={2}>
          {/* Battery summary */}
          {battPct != null && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <BatteryIcon pct={battPct} />
              <Typography fontFamily="Inter, sans-serif" fontSize={12} fontWeight={600} color={batteryColor(battPct)}>
                {battPct.toFixed(0)}%
              </Typography>
            </Stack>
          )}

          {/* Overall health indicator */}
          <Chip
            icon={overallHealthy && !hasStale
              ? <CheckCircleIcon style={{ fontSize: 14 }} />
              : <ErrorIcon style={{ fontSize: 14 }} />}
            label={hasStale ? "Stale data" : overallHealthy ? "All sensors OK" : "Issues detected"}
            size="small"
            sx={{
              bgcolor: hasStale ? "rgba(255,77,77,0.12)" : overallHealthy ? "rgba(76,175,80,0.15)" : "rgba(255,77,77,0.12)",
              color: hasStale ? "#FF4D4D" : overallHealthy ? "#4CAF50" : "#FF4D4D",
              border: `1px solid ${hasStale ? "#FF4D4D40" : overallHealthy ? "#4CAF5040" : "#FF4D4D40"}`,
              fontWeight: 600,
              fontSize: 11,
              "& .MuiChip-icon": { color: "inherit" },
            }}
          />
        </Stack>
      </Box>

      {/* Column headers */}
      {sensors.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "2fr 1fr 2fr 2fr" },
            gap: { xs: 1, sm: 2 },
            px: { xs: 1.5, sm: 2 },
            py: 0.75,
            bgcolor: "rgba(0,0,0,0.03)",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {["Sensor", "Status", "Latest Reading", "Last Updated"].map((h) => (
            <Typography key={h} fontFamily="Inter, sans-serif" fontWeight={700} fontSize={11} color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
              {h}
            </Typography>
          ))}
        </Box>
      )}

      {/* Sensor rows */}
      {sensors.length === 0 ? (
        <Box px={2} py={3}>
          <Typography fontFamily="Inter, sans-serif" fontSize={13} color="text.secondary">
            No sensors found for this hive.
          </Typography>
        </Box>
      ) : (
        sensors.map((s, i) => (
          <SensorRow key={s.sensor_id} sensor={s} isLast={i === sensors.length - 1} />
        ))
      )}
    </Paper>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();

  // ── Personal info ──────────────────────────────────────────────────────────
  const [userData, setUserData] = useState(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [userLoading, setUserLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // ── Hive sensors ───────────────────────────────────────────────────────────
  const [hiveData, setHiveData] = useState([]);
  const [hivesLoading, setHivesLoading] = useState(true);

  // ── Load user ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function loadUser() {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("email", user.email)
        .single();
      if (data) {
        setUserData(data);
        setEditForm({
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          phone: data.phone ?? "",
        });
      }
      setUserLoading(false);
    }
    loadUser();
  }, [user]);

  // ── Load hive sensor health ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    async function loadHiveSensors() {
      setHivesLoading(true);
      try {
        const { data: ud } = await supabase
          .from("users")
          .select("user_id")
          .eq("email", user.email)
          .single();
        if (!ud) return;

        const { data: hives } = await supabase
          .from("beehives")
          .select("hive_id, hive_code, hive_status")
          .eq("owner_id", ud.user_id);

        const result = await Promise.all(
          (hives ?? []).map(async (hive) => {
            const { data: boards } = await supabase
              .from("iot_boards")
              .select("board_id")
              .eq("hive_id", hive.hive_id);

            const boardIds = (boards ?? []).map((b) => b.board_id);
            if (boardIds.length === 0) return { hive, sensors: [] };

            const { data: sensors } = await supabase
              .from("sensors")
              .select("sensor_id, board_id, sensor_type, unit, status")
              .in("board_id", boardIds)
              .order("sensor_type", { ascending: true });

            const sensorIds = (sensors ?? []).map((s) => s.sensor_id);

            // Fetch latest valid reading per sensor
            const latestReadings = {};
            await Promise.all(
              sensorIds.map(async (sid) => {
                const { data: reading } = await supabase
                  .from("sensor_readings")
                  .select("value, unit, timestamp, is_valid")
                  .eq("sensor_id", sid)
                  .eq("is_valid", true)
                  .order("timestamp", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (reading) latestReadings[sid] = reading;
              })
            );

            const enrichedSensors = (sensors ?? []).map((s) => ({
              ...s,
              latestReading: latestReadings[s.sensor_id] ?? null,
            }));

            return { hive, sensors: enrichedSensors };
          })
        );

        setHiveData(result);
      } finally {
        setHivesLoading(false);
      }
    }
    loadHiveSensors();
  }, [user]);

  // ── Save personal info ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!userData) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updates = {};
      if (editForm.first_name.trim()) updates.first_name = editForm.first_name.trim();
      if ("last_name" in editForm) updates.last_name = editForm.last_name.trim();
      if ("phone" in editForm) updates.phone = editForm.phone.trim();

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("user_id", userData.user_id);

      if (error) throw error;
      setUserData((prev) => ({ ...prev, ...updates }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      setSaveError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    editForm.first_name !== (userData?.first_name ?? "") ||
    editForm.last_name  !== (userData?.last_name  ?? "") ||
    editForm.phone      !== (userData?.phone       ?? "");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff9e9" }}>
      <NavBar />

      <Box sx={{ maxWidth: 900, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>

        {/* ── Personal Info ── */}
        <SectionHeader
          title="Personal Info"
          subtitle="Update your name and contact details."
        />

        <Paper
          variant="outlined"
          sx={{ border: "2px solid black", borderRadius: "11px", bgcolor: "#fff9e9", mb: 5 }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            {userLoading ? (
              <Stack spacing={2}>
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
                <Skeleton variant="rounded" height={56} />
              </Stack>
            ) : (
              <Stack spacing={2.5}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="First Name"
                      fullWidth
                      value={editForm.first_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                      size="small"
                      inputProps={{ style: { fontFamily: "Inter, sans-serif" } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Last Name"
                      fullWidth
                      value={editForm.last_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                      size="small"
                      inputProps={{ style: { fontFamily: "Inter, sans-serif" } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Email"
                      fullWidth
                      value={user?.email ?? ""}
                      disabled
                      size="small"
                      helperText="Email cannot be changed here"
                      inputProps={{ style: { fontFamily: "Inter, sans-serif" } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Phone"
                      fullWidth
                      value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      size="small"
                      placeholder="+1 (555) 000-0000"
                      inputProps={{ style: { fontFamily: "Inter, sans-serif" } }}
                    />
                  </Grid>
                </Grid>

                {saveSuccess && (
                  <Alert severity="success" sx={{ fontFamily: "Inter, sans-serif" }}>
                    Profile updated successfully.
                  </Alert>
                )}
                {saveError && (
                  <Alert severity="error" sx={{ fontFamily: "Inter, sans-serif" }}>
                    {saveError}
                  </Alert>
                )}

                <Box>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    sx={{
                      bgcolor: "#FE9805",
                      color: "black",
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 700,
                      textTransform: "none",
                      px: 3,
                      "&:hover": { bgcolor: "#e08900" },
                      "&.Mui-disabled": { bgcolor: "#fbc139", color: "rgba(0,0,0,0.4)" },
                    }}
                  >
                    {saving ? <CircularProgress size={18} sx={{ color: "black" }} /> : "Save Changes"}
                  </Button>
                </Box>
              </Stack>
            )}
          </CardContent>
        </Paper>

        {/* ── Hive Sensors & Health ── */}
        <SectionHeader
          title="Hive Sensors & System Health"
          subtitle="Live status, latest readings, and battery levels for each hive's sensors."
        />

        {hivesLoading ? (
          <Stack spacing={2}>
            {[1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={180} sx={{ borderRadius: "11px" }} />
            ))}
          </Stack>
        ) : hiveData.length === 0 ? (
          <Typography fontFamily="Inter, sans-serif" color="text.secondary">
            No hives found.
          </Typography>
        ) : (
          <Stack spacing={3}>
            {hiveData.map(({ hive, sensors }) => (
              <HiveSensorCard key={hive.hive_id} hive={hive} sensors={sensors} />
            ))}
          </Stack>
        )}

      </Box>
      <Footer />
    </Box>
  );
}
