import { useEffect, useMemo, useState } from "react";
import { supabase } from "../createClient";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AdminOverviewUI from "../components/AdminOverviewUI";

export default function AdminOverview() {
  const [hives, setHives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState("hives");

  useEffect(() => {
    async function loadAllHives() {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.from("beehives").select("*");

        if (error) throw error;

        setHives(data ?? []);
      } catch (e) {
        setError(e.message || "Failed to load hives");
      } finally {
        setLoading(false);
      }
    }

    loadAllHives();
  }, []);

  const filteredHives = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) return hives;

    return hives.filter((hive) => {
      const hiveCode = hive.hive_code?.toLowerCase() || "";
      const locationDescription = hive.location_description?.toLowerCase() || "";
      const hiveStatus = hive.hive_status?.toLowerCase() || "";
      const hiveId = String(hive.hive_id ?? "").toLowerCase();

      return (
        hiveCode.includes(query) ||
        locationDescription.includes(query) ||
        hiveStatus.includes(query) ||
        hiveId.includes(query)
      );
    });
  }, [hives, searchValue]);

  const uiHives = useMemo(() => {
    return filteredHives.map((hive) => ({
      hive_id: hive.hive_id,
      name: hive.hive_code || `Hive ${hive.hive_id}`,
      currentTemp: "--",
      status: hive.hive_status || "unknown",
      systemOnline: hive.hive_status?.toLowerCase() === "active",
    }));
  }, [filteredHives]);

  const stats = useMemo(() => {
    const totalHives = hives.length;
    const systemsOnline = hives.filter(
      (hive) => hive.hive_status?.toLowerCase() === "active"
    ).length;
    const systemsOffline = totalHives - systemsOnline;

    return {
      totalHives,
      activeAlerts: 0,
      systemsOffline,
      systemsOnline,
    };
  }, [hives]);

  if (loading) {
    return <Box sx={{ p: 3 }}>Loading admin dashboard...</Box>;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <AdminOverviewUI
      stats={stats}
      hives={uiHives}
      activeTab={activeTab}
      searchValue={searchValue}
      onTabChange={setActiveTab}
      onSearchChange={setSearchValue}
      onFilterClick={() => {}}
      onAlertsClick={() => {}}
      onDatabaseClick={() => {}}
      onSettingsClick={() => {}}
    />
  );
}