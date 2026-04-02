import { useEffect, useMemo, useState } from "react";
import { supabase } from "../createClient";
import { useAuth } from "../context/AuthContext";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import HiveOverviewUI from "../components/HiveOverviewUI";

export default function HiveOverview() {
  const { user } = useAuth();

  const [appUser, setAppUser] = useState(null);
  const [hives, setHives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          .select("*")
          .eq("owner_id", userData.user_id);

        if (hiveError) throw hiveError;

        setHives(hiveData ?? []);
      } catch (e) {
        setError(e.message || "Failed to load hives");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  const uiHives = useMemo(() => {
    return hives.map((hive) => ({
      hive_id: hive.hive_id,
      name: hive.hive_code || `Hive ${hive.hive_id}`,
      currentTemp: "--",
      status: hive.hive_status || "unknown",
      systemOnline: hive.hive_status?.toLowerCase() === "active",
    }));
  }, [hives]);

  const stats = useMemo(() => {
    const totalHives = hives.length;
    const systemsOnline = hives.filter(
      (hive) => hive.hive_status?.toLowerCase() === "active"
    ).length;

    return {
      totalHives,
      activeAlerts: 0,
      avgTemp: "--",
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
      onSortClick={() => {}}
      onFilterClick={() => {}}
      onAlertsClick={() => {}}
      onDatabaseClick={() => {}}
      onSettingsClick={() => {}}
    />
  );
}