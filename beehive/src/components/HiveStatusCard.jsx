import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { supabase } from "../createClient";

const ALERT_COLORS = {
  critical: "#FF4D4D",
  warning:  "#FE9805",
  info:     "#4DA6FF",
};

export default function HiveStatusCard({ hiveId }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hiveId) return;
    async function loadAlerts() {
      const { data } = await supabase
        .from("alerts")
        .select("alert_id, message, alert_level, timestamp")
        .eq("hive_id", hiveId)
        .eq("resolved", false)
        .order("timestamp", { ascending: false })
        .limit(50);
      if (data) setAlerts(data);
      setLoading(false);
    }
    loadAlerts();
  }, [hiveId]);

  return (
    <Card
      sx={{
        backgroundColor: "var(--bg)",
        border: "2px solid var(--outline)",
        boxShadow: "none",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          boxSizing: "border-box",
          overflow: "hidden",
          p: 0,
          "&:last-child": { pb: 0 },
        }}
      >
        <Typography variant="h3" align="center" sx={{ mb: 2, flexShrink: 0, pt: 3 }}>
          Current Status of Hive
        </Typography>

        <Typography
          variant="body2"
          sx={{ fontWeight: 700, mb: 1, fontSize: "0.78rem", letterSpacing: 0.5, flexShrink: 0, px: 2 }}
        >
          Active Alerts
        </Typography>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {loading ? (
              <Typography variant="body2" sx={{ color: "var(--caption)", fontSize: "0.75rem" }}>
                Loading…
              </Typography>
            ) : alerts.length === 0 ? (
              <Typography variant="body2" sx={{ color: "var(--caption)", fontSize: "0.75rem" }}>
                No active alerts
              </Typography>
            ) : (
              alerts.map((alert) => {
                const color = ALERT_COLORS[alert.alert_level] ?? "#888";
                return (
                  <Box
                    key={alert.alert_id}
                    onClick={() => navigate(`/alerts?highlight=${alert.alert_id}`)}
                    sx={{
                      cursor: "pointer",
                      py: 0.75,
                      px: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      borderLeft: `3px solid ${color}`,
                      backgroundColor: `${color}14`,
                      "&:hover": { backgroundColor: `${color}26` },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontSize: "0.75rem", lineHeight: 1.3, color: "var(--text)" }}
                    >
                      {alert.message}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "var(--caption)" }}>
                      {new Date(alert.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </Box>
                );
              })
            )}
        </Box>
      </CardContent>
    </Card>
  );
}
