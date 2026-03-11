import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

import { fetchAlerts, acknowledgeAlert, resolveAlert } from "../api/alerts";

// ─── Config ───────────────────────────────────────────────────────────────────

const HIVE_IDS = [25, 26, 27, 28, 29, 30, 31, 32];

const LEVEL = {
  critical: {
    label: "Critical",
    color: "#c62828",
    bg: "#fff5f5",
    border: "#ef9a9a",
    icon: ErrorOutlineIcon,
    chipSx: { backgroundColor: "#c62828", color: "#fff" },
  },
  warning: {
    label: "Warning",
    color: "#e65100",
    bg: "#fff8f0",
    border: "#ffcc80",
    icon: WarningAmberIcon,
    chipSx: { backgroundColor: "#e65100", color: "#fff" },
  },
  info: {
    label: "Info",
    color: "#0277bd",
    bg: "#f0f8ff",
    border: "#90caf9",
    icon: InfoOutlinedIcon,
    chipSx: { backgroundColor: "#0277bd", color: "#fff" },
  },
};

function levelOf(alert) {
  return LEVEL[alert.alert_level] ?? LEVEL.info;
}

// ─── Summary pills ────────────────────────────────────────────────────────────

function StatPill({ value, label, color, bg, border }) {
  return (
    <Box
      sx={{
        textAlign: "center",
        px: 2.5,
        py: 1.25,
        borderRadius: 2,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        minWidth: 80,
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: "1.5rem", color, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: "0.7rem" }}>
        {label}
      </Typography>
    </Box>
  );
}

// ─── Single alert row ─────────────────────────────────────────────────────────

function AlertRow({ alert, onAcknowledge, onResolve, actioning }) {
  const lv = levelOf(alert);
  const Icon = lv.icon;
  const isResolved = alert.resolved;
  const isAcked = alert.acknowledged;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 2,
        px: 2,
        py: 1.5,
        borderRadius: 1.5,
        backgroundColor: isResolved ? "transparent" : lv.bg,
        borderLeft: `4px solid ${isResolved ? "#bdbdbd" : lv.color}`,
        opacity: isResolved ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Icon */}
      <Box sx={{ pt: 0.3, flexShrink: 0 }}>
        <Icon sx={{ color: isResolved ? "#9e9e9e" : lv.color, fontSize: 20 }} />
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 0.25 }}>
          <Chip
            label={lv.label}
            size="small"
            sx={{
              ...lv.chipSx,
              height: 20,
              fontSize: "0.68rem",
              fontWeight: 700,
              opacity: isResolved ? 0.5 : 1,
            }}
          />
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
            Hive {alert.hive_id}
          </Typography>
          {isAcked && !isResolved && (
            <Chip
              label="Acknowledged"
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: "0.65rem", borderColor: "#9e9e9e", color: "#757575" }}
            />
          )}
          {isResolved && (
            <Chip
              label="Resolved"
              size="small"
              variant="outlined"
              sx={{ height: 18, fontSize: "0.65rem", borderColor: "#4caf50", color: "#4caf50" }}
            />
          )}
        </Stack>

        <Typography variant="body2" sx={{ lineHeight: 1.45, wordBreak: "break-word" }}>
          {alert.message}
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }} flexWrap="wrap">
          {alert.sensor_value !== null && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Value: {parseFloat(alert.sensor_value).toFixed(1)}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {dayjs(alert.timestamp).fromNow()} · {dayjs(alert.timestamp).format("MMM D, YYYY HH:mm")}
          </Typography>
          {alert.resolved_at && (
            <Typography variant="caption" sx={{ color: "#4caf50" }}>
              Resolved {dayjs(alert.resolved_at).fromNow()}
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Actions */}
      {!isResolved && (
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, pt: 0.25 }}>
          {!isAcked && (
            <Tooltip title="Acknowledge">
              <span>
                <IconButton
                  size="small"
                  disabled={actioning}
                  onClick={() => onAcknowledge(alert.alert_id)}
                  sx={{ color: "#757575" }}
                >
                  <DoneAllIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title="Mark as resolved">
            <span>
              <Button
                size="small"
                variant="outlined"
                disabled={actioning}
                onClick={() => onResolve(alert.alert_id)}
                sx={{
                  fontSize: "0.7rem",
                  py: 0.25,
                  px: 1,
                  minWidth: 0,
                  borderColor: "#4caf50",
                  color: "#4caf50",
                  "&:hover": { borderColor: "#388e3c", backgroundColor: "#f0fdf4" },
                }}
              >
                Resolve
              </Button>
            </span>
          </Tooltip>
        </Stack>
      )}
    </Box>
  );
}

// ─── Hive group card ──────────────────────────────────────────────────────────

function HiveAlertGroup({ hiveId, alerts, onAcknowledge, onResolve, actioning }) {
  const activeAlerts = alerts.filter((a) => !a.resolved);
  const critCount = activeAlerts.filter((a) => a.alert_level === "critical").length;
  const warnCount = activeAlerts.filter((a) => a.alert_level === "warning").length;
  const borderColor =
    critCount > 0 ? "#c62828" : warnCount > 0 ? "#e65100" : "#4caf50";

  return (
    <Card
      sx={{
        border: `2px solid ${borderColor}`,
        boxShadow: "none",
        backgroundColor: "var(--bg, #fff)",
      }}
    >
      <CardContent sx={{ pb: "12px !important" }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: alerts.length > 0 ? 1.5 : 0 }}>
          {activeAlerts.length === 0 ? (
            <CheckCircleOutlineIcon sx={{ color: "#4caf50", fontSize: 18 }} />
          ) : critCount > 0 ? (
            <ErrorOutlineIcon sx={{ color: "#c62828", fontSize: 18 }} />
          ) : (
            <WarningAmberIcon sx={{ color: "#e65100", fontSize: 18 }} />
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Hive {hiveId}
          </Typography>
          {critCount > 0 && (
            <Chip label={`${critCount} critical`} size="small" sx={{ backgroundColor: "#c62828", color: "#fff", fontWeight: 700, height: 20, fontSize: "0.68rem" }} />
          )}
          {warnCount > 0 && (
            <Chip label={`${warnCount} warning`} size="small" sx={{ backgroundColor: "#e65100", color: "#fff", fontWeight: 700, height: 20, fontSize: "0.68rem" }} />
          )}
          {activeAlerts.length === 0 && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              All clear
            </Typography>
          )}
        </Stack>

        {alerts.length > 0 && (
          <Stack spacing={0.75}>
            {alerts.map((alert, i) => (
              <AlertRow
                key={alert.alert_id}
                alert={alert}
                onAcknowledge={onAcknowledge}
                onResolve={onResolve}
                actioning={actioning.has(alert.alert_id)}
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [allAlerts, setAllAlerts] = useState(null); // null = loading
  const [error, setError]         = useState(null);
  const [tab, setTab]             = useState(0);     // 0=active, 1=all
  const [actioning, setActioning] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    setAllAlerts(null);
    setError(null);

    fetchAlerts({ resolved: null })
      .then((data) => { if (!cancelled) setAllAlerts(data); })
      .catch((e)   => { if (!cancelled) setError(e?.message ?? "Failed to load alerts"); });

    return () => { cancelled = true; };
  }, [refreshKey]);

  // ── Actions ──
  const handleAcknowledge = useCallback(async (alertId) => {
    setActioning((s) => new Set(s).add(alertId));
    try {
      const updated = await acknowledgeAlert(alertId);
      setAllAlerts((prev) =>
        prev.map((a) => (a.alert_id === alertId ? { ...a, ...updated } : a))
      );
    } catch (e) {
      console.error("Acknowledge failed:", e);
    } finally {
      setActioning((s) => { const n = new Set(s); n.delete(alertId); return n; });
    }
  }, []);

  const handleResolve = useCallback(async (alertId) => {
    setActioning((s) => new Set(s).add(alertId));
    try {
      const updated = await resolveAlert(alertId);
      setAllAlerts((prev) =>
        prev.map((a) => (a.alert_id === alertId ? { ...a, ...updated } : a))
      );
    } catch (e) {
      console.error("Resolve failed:", e);
    } finally {
      setActioning((s) => { const n = new Set(s); n.delete(alertId); return n; });
    }
  }, []);

  // ── Derived data ──
  const { visibleAlerts, critTotal, warnTotal, infoTotal, activeTotal, resolvedTotal } =
    useMemo(() => {
      if (!allAlerts) return { visibleAlerts: [], critTotal: 0, warnTotal: 0, infoTotal: 0, activeTotal: 0, resolvedTotal: 0 };

      const active   = allAlerts.filter((a) => !a.resolved);
      const resolved = allAlerts.filter((a) => a.resolved);

      return {
        visibleAlerts: tab === 0 ? active : allAlerts,
        critTotal:     active.filter((a) => a.alert_level === "critical").length,
        warnTotal:     active.filter((a) => a.alert_level === "warning").length,
        infoTotal:     active.filter((a) => a.alert_level === "info").length,
        activeTotal:   active.length,
        resolvedTotal: resolved.length,
      };
    }, [allAlerts, tab]);

  // Group by hive, only show hives that have alerts in the current view
  const hiveGroups = useMemo(() => {
    const map = new Map();
    for (const id of HIVE_IDS) map.set(id, []);
    for (const a of visibleAlerts) {
      if (map.has(a.hive_id)) map.get(a.hive_id).push(a);
      else map.set(a.hive_id, [a]);
    }
    // Sort hive groups: most severe first, then hive ID
    return Array.from(map.entries())
      .filter(([, alerts]) => alerts.length > 0 || tab === 0) // active tab: show all hives; history: only hives with data
      .sort(([, a], [, b]) => {
        const score = (arr) =>
          arr.filter((x) => !x.resolved && x.alert_level === "critical").length * 100 +
          arr.filter((x) => !x.resolved && x.alert_level === "warning").length  * 10;
        return score(b) - score(a);
      });
  }, [visibleAlerts, tab]);

  // ── Render ──
  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>

      {/* Page header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Alerts
        </Typography>
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={() => setRefreshKey((k) => k + 1)} disabled={allAlerts === null}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {/* Summary bar */}
      {allAlerts !== null && (
        <Card sx={{ border: "2px solid var(--outline, #e0e0e0)", boxShadow: "none", backgroundColor: "var(--bg, #fff)", mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }} justifyContent="space-between">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Active Alert Summary
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {HIVE_IDS.length} hives monitored · {resolvedTotal} resolved
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5} flexWrap="wrap">
                <StatPill value={critTotal}   label="Critical" color="#c62828" bg="#fff5f5" border="#ef9a9a" />
                <StatPill value={warnTotal}   label="Warnings" color="#e65100" bg="#fff8f0" border="#ffcc80" />
                <StatPill value={infoTotal}   label="Info"     color="#0277bd" bg="#f0f8ff" border="#90caf9" />
              </Stack>
            </Stack>

            {activeTotal === 0 && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                <CheckCircleOutlineIcon sx={{ color: "#4caf50" }} />
                <Typography variant="body1" sx={{ color: "#2e7d32", fontWeight: 600 }}>
                  All hives operating within normal parameters.
                </Typography>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: "1px solid var(--outline, #e0e0e0)" }}
      >
        <Tab
          label={
            <Stack direction="row" spacing={0.75} alignItems="center">
              <span>Active</span>
              {activeTotal > 0 && (
                <Chip label={activeTotal} size="small" sx={{ backgroundColor: "#c62828", color: "#fff", height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
              )}
            </Stack>
          }
        />
        <Tab label="All Alerts" />
      </Tabs>

      {/* Error */}
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          Error: {error}
        </Typography>
      )}

      {/* Loading */}
      {allAlerts === null && !error && (
        <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
          <CircularProgress sx={{ color: "#FE9805" }} />
          <Typography color="text.secondary">Loading alerts…</Typography>
        </Stack>
      )}

      {/* Hive groups */}
      {allAlerts !== null && (
        <Stack spacing={2}>
          {hiveGroups.length === 0 && (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 48, color: "#4caf50", mb: 1 }} />
              <Typography variant="h6" sx={{ color: "#2e7d32" }}>
                No active alerts
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                All hives are healthy.
              </Typography>
            </Box>
          )}
          {hiveGroups.map(([hiveId, alerts]) => (
            <HiveAlertGroup
              key={hiveId}
              hiveId={hiveId}
              alerts={alerts}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              actioning={actioning}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
