import { useEffect, useState } from "react";
import { Box, Typography, Alert, Stack } from "@mui/material";
import { supabase } from "../createClient";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadAlerts();

    const channel = supabase
      .channel("alerts-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          loadAlerts();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadAlerts() {
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .order("timestamp", { ascending: false });

    setAlerts(data || []);
  }

  return (
    <Box p={3}>
      <Typography variant="h4" mb={2}>
        Hive Alerts
      </Typography>

      <Stack spacing={2}>
        {alerts.map((a) => (
          <Alert key={a.alert_id} severity={a.alert_level}>
            {a.message}
          </Alert>
        ))}
      </Stack>
    </Box>
  );
}
