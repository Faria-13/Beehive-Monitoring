import { useEffect, useMemo, useState } from "react";
import { supabase } from "../createClient";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AdminOverviewUI from "../components/AdminOverviewUI";

export default function AdminOverview() {
  const [hives, setHives]         = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState("hives");

  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user: authUser },
          error: authErr,
        } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        // ── Hives ──────────────────────────────────────────────────────────
        const { data: hiveData, error: hiveErr } = await supabase
          .from("beehives")
          .select("*");
        if (hiveErr) throw hiveErr;

        // ── Users ──────────────────────────────────────────────────────────
        const { data: userData, error: userErr } = await supabase
          .from("users")
          .select("user_id, first_name, last_name, email");
        if (userErr) throw userErr;

        const visibleUsers = (userData ?? []).filter((u) => {
          if (authUser?.email && u.email === authUser.email) return false;
          if (authUser?.id && String(u.user_id) === String(authUser.id)) return false;
          return true;
        });

        // ── Active alerts (unresolved) ─────────────────────────────────────
        const { data: alertData } = await supabase
          .from("alerts")
          .select("hive_id")
          .eq("resolved", false);

        const alertHiveSet = new Set((alertData ?? []).map((a) => a.hive_id));

        // ── Enrich users with hive count + alert count ─────────────────────
        // Build owner_id → hive_ids map
        const hivesByOwner = {};
        for (const hive of hiveData ?? []) {
          if (!hivesByOwner[hive.owner_id]) hivesByOwner[hive.owner_id] = [];
          hivesByOwner[hive.owner_id].push(hive.hive_id);
        }

        const enrichedUsers = visibleUsers.map((u) => {
          const userHiveIds = hivesByOwner[u.user_id] ?? [];
          const alertCount  = userHiveIds.filter((id) => alertHiveSet.has(id)).length;
          return {
            ...u,
            hiveCount:  userHiveIds.length,
            alertCount,
          };
        });

        setHives(hiveData ?? []);
        setUsers(enrichedUsers);
      } catch (e) {
        setError(e.message || "Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  // ── Filtered hives ─────────────────────────────────────────────────────────
  const filteredHives = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return hives;
    return hives.filter((h) =>
      (h.hive_code           ?? "").toLowerCase().includes(q) ||
      (h.location_description?? "").toLowerCase().includes(q) ||
      (h.hive_status         ?? "").toLowerCase().includes(q) ||
      String(h.hive_id ?? "").toLowerCase().includes(q)
    );
  }, [hives, searchValue]);

  // ── Filtered users ─────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.first_name ?? "").toLowerCase().includes(q) ||
      (u.last_name  ?? "").toLowerCase().includes(q) ||
      (u.email      ?? "").toLowerCase().includes(q)
    );
  }, [users, searchValue]);

  // ── UI hives ───────────────────────────────────────────────────────────────
  const uiHives = useMemo(() =>
    filteredHives.map((h) => ({
      hive_id:    h.hive_id,
      name:       h.hive_code || `Hive ${h.hive_id}`,
      status:     h.hive_status || "unknown",
      systemOnline: h.hive_status?.toLowerCase() === "active",
    })),
  [filteredHives]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalHives    = hives.length;
    const systemsOnline = hives.filter((h) => h.hive_status?.toLowerCase() === "active").length;
    const activeAlerts  = users.reduce((sum, u) => sum + (u.alertCount ?? 0), 0);
    return {
      totalHives,
      activeAlerts,
      systemsOffline: totalHives - systemsOnline,
      systemsOnline,
    };
  }, [hives, users]);

  if (loading) return <Box sx={{ p: 3 }}>Loading admin dashboard...</Box>;
  if (error)   return <Box sx={{ p: 3 }}><Typography color="error">Error: {error}</Typography></Box>;

  return (
    <AdminOverviewUI
      stats={stats}
      hives={uiHives}
      users={filteredUsers}
      activeTab={activeTab}
      searchValue={searchValue}
      onTabChange={(tab) => { setActiveTab(tab); setSearchValue(""); }}
      onSearchChange={setSearchValue}
      onFilterClick={() => {}}
    />
  );
}
