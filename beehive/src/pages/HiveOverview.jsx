import { useEffect, useMemo, useState } from "react";
import { supabase } from "../createClient";
import { useAuth } from "../context/AuthContext";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import HiveOverviewUI from "../components/HiveOverviewUI";

import beeIcon from "../assets/beeIcon.png";
import beeIcon2 from "../assets/beeIcon2.png";

const DEFAULT_BG_COLORS = ["#FE9805", "#FBC139", "#FFF3D0", "#FBDA7D"];
const DEFAULT_ICONS = [beeIcon, beeIcon2];

export default function HiveOverview() {
  const { user } = useAuth();

  const [appUser, setAppUser] = useState(null);
  const [hives, setHives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("email", user.email)
          .single();

        if (userError) throw userError;

        setAppUser(userData);

        const { data: hiveData, error: hiveError } = await supabase
          .from("beehives")
          .select(`
            *,
            avatar_type,
            avatar_storage_path,
            avatar_bg_color
          `)
          .eq("owner_id", userData.user_id);

        if (hiveError) throw hiveError;

        const safeHives = hiveData ?? [];

        const enrichedHives = await Promise.all(
          safeHives.map(async (hive, index) => {
            try {
              const { data: boards, error: boardsError } = await supabase
                .from("iot_boards")
                .select("board_id")
                .eq("hive_id", hive.hive_id);

              if (boardsError) throw boardsError;

              const boardIds = (boards ?? []).map((board) => board.board_id);

              let currentTemp = null;
              let tempUnit = null;

              if (boardIds.length > 0) {
                const { data: tempSensors, error: sensorsError } = await supabase
                  .from("sensors")
                  .select("sensor_id, sensor_type, unit")
                  .in("board_id", boardIds)
                  .eq("sensor_type", "temperature");

                if (sensorsError) throw sensorsError;

                const sensorIds = (tempSensors ?? []).map((sensor) => sensor.sensor_id);

                if (sensorIds.length > 0) {
                  const { data: latestReading, error: readingsError } = await supabase
                    .from("sensor_readings")
                    .select("sensor_id, value, unit, timestamp, is_valid")
                    .in("sensor_id", sensorIds)
                    .eq("is_valid", true)
                    .order("timestamp", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (readingsError) throw readingsError;

                  const numericTemp = Number(latestReading?.value);
                  currentTemp = Number.isFinite(numericTemp) ? numericTemp : null;
                  tempUnit = latestReading?.unit ?? tempSensors?.[0]?.unit ?? null;
                }
              }

              let avatarUrl = null;

              if (hive.avatar_type === "custom" && hive.avatar_storage_path) {
                const { data: publicUrlData } = supabase.storage
                  .from("hive-avatars")
                  .getPublicUrl(hive.avatar_storage_path);

                avatarUrl = publicUrlData?.publicUrl ?? null;
              }

              return {
                ...hive,
                currentTemp,
                tempUnit,
                avatarUrl,
                fallbackIcon: DEFAULT_ICONS[index % DEFAULT_ICONS.length],
                resolvedBgColor:
                  hive.avatar_bg_color ||
                  DEFAULT_BG_COLORS[index % DEFAULT_BG_COLORS.length],
              };
            } catch (err) {
              console.error(`Failed to load hive ${hive.hive_id}:`, err);

              let avatarUrl = null;

              if (hive.avatar_type === "custom" && hive.avatar_storage_path) {
                const { data: publicUrlData } = supabase.storage
                  .from("hive-avatars")
                  .getPublicUrl(hive.avatar_storage_path);

                avatarUrl = publicUrlData?.publicUrl ?? null;
              }

              return {
                ...hive,
                currentTemp: null,
                tempUnit: null,
                avatarUrl,
                fallbackIcon: DEFAULT_ICONS[index % DEFAULT_ICONS.length],
                resolvedBgColor:
                  hive.avatar_bg_color ||
                  DEFAULT_BG_COLORS[index % DEFAULT_BG_COLORS.length],
              };
            }
          })
        );

        // Fetch active (unresolved) alerts for all hives in one query
        const hiveIds = safeHives.map((h) => h.hive_id);
        let activeAlertHiveIds = new Set();
        if (hiveIds.length > 0) {
          const { data: alertData } = await supabase
            .from("alerts")
            .select("hive_id")
            .eq("resolved", false)
            .in("hive_id", hiveIds);
          if (alertData) {
            alertData.forEach((a) => activeAlertHiveIds.add(a.hive_id));
          }
        }

        setHives(
          enrichedHives.map((hive) => ({
            ...hive,
            hasActiveAlerts: activeAlertHiveIds.has(hive.hive_id),
          }))
        );
      } catch (e) {
        setError(e.message || "Failed to load hives");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, refreshKey]);

  const uiHives = useMemo(() => {
    return hives.map((hive) => ({
      hive_id: hive.hive_id,
      name: hive.hive_code || `Hive ${hive.hive_id}`,
      currentTemp:
        hive.currentTemp == null
          ? "--"
          : `${Math.round(hive.currentTemp * 100) / 100}${hive.tempUnit ?? ""}`,
      tempValue: hive.currentTemp,
      createdAt: hive.created_at ?? null,
      status: hive.hive_status || "unknown",
      systemOnline: hive.hive_status?.toLowerCase() === "active",
      hasActiveAlerts: hive.hasActiveAlerts ?? false,
      avatarUrl: hive.avatarUrl,
      fallbackIcon: hive.fallbackIcon,
      avatarBgColor: hive.resolvedBgColor,
    }));
  }, [hives]);

  const stats = useMemo(() => {
    const totalHives = hives.length;
    const systemsOnline = hives.filter(
      (hive) => hive.hive_status?.toLowerCase() === "active"
    ).length;

    const validTemps = hives
      .map((hive) => Number(hive.currentTemp))
      .filter((temp) => Number.isFinite(temp));

    const avgTemp =
      validTemps.length === 0
        ? "--"
        : Math.round(
            (validTemps.reduce((sum, temp) => sum + temp, 0) / validTemps.length) * 100
          ) / 100;

    const activeAlerts = hives.filter((hive) => hive.hasActiveAlerts).length;

    return {
      totalHives,
      activeAlerts,
      avgTemp: avgTemp === "--" ? "--" : `${avgTemp}°C`,
      systemsOnline,
    };
  }, [hives]);

  if (loading) {
    return <Box sx={{ p: 3 }}>Loading...</Box>;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <HiveOverviewUI
      userName={appUser?.first_name || "User"}
      stats={stats}
      hives={uiHives}
      onHiveUpdated={() => setRefreshKey((k) => k + 1)}
      onSettingsClick={() => {}}
    />
  );
}