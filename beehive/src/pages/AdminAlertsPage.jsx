import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../createClient";
import AdminNavBar from "../components/AdminNavBar";
import Footer from "../components/Footer";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

const LEVEL_META = {
  critical: {
    color: "#FF4D4D",
    bg: "rgba(255,77,77,0.10)",
    border: "rgba(255,77,77,0.35)",
    label: "CRITICAL",
    icon: "⚠",
  },
  warning: {
    color: "#FE9805",
    bg: "rgba(254,152,5,0.10)",
    border: "rgba(254,152,5,0.35)",
    label: "WARNING",
    icon: "⚡",
  },
  info: {
    color: "#4DA6FF",
    bg: "rgba(77,166,255,0.10)",
    border: "rgba(77,166,255,0.35)",
    label: "INFO",
    icon: "ℹ",
  },
};

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MultiSelectFilter({ label, options, selected, onToggle, onSelectAll, onClearAll, getLabel }) {
  const [anchor, setAnchor] = useState(null);
  const allSelected = selected.length === options.length;
  const someSelected = selected.length > 0 && !allSelected;

  return (
    <>
      <Button
        variant="outlined"
        endIcon={<ArrowDropDownIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          borderColor: someSelected || (selected.length > 0 && !allSelected) ? "#FE9805" : "#ccc",
          color: "black",
          textTransform: "none",
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {selected.length > 0 && selected.length < options.length && (
          <Chip
            label={selected.length}
            size="small"
            sx={{ ml: 1, height: 18, fontSize: 11, bgcolor: "#FE9805", color: "white" }}
          />
        )}
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem dense onClick={allSelected ? onClearAll : onSelectAll}>
          <Checkbox size="small" checked={allSelected} indeterminate={someSelected} sx={{ p: 0.5 }} />
          <Typography fontSize={13} sx={{ ml: 1 }}>
            {allSelected ? "Deselect all" : "Select all"}
          </Typography>
        </MenuItem>
        <Divider />
        {options.map((opt) => (
          <MenuItem key={String(opt)} dense onClick={() => onToggle(opt)}>
            <Checkbox size="small" checked={selected.includes(opt)} sx={{ p: 0.5 }} />
            <Typography fontSize={13} sx={{ ml: 1 }}>
              {getLabel ? getLabel(opt) : String(opt)}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function Toast({ toasts, onDismiss }) {
  return (
    <div style={styles.toastContainer}>
      {toasts.map((t) => {
        const meta = LEVEL_META[t.alert_level] ?? LEVEL_META.info;
        return (
          <div
            key={t.id}
            style={{
              ...styles.toast,
              borderLeft: `4px solid ${meta.color}`,
              animation: "slideIn 0.3s ease",
            }}
          >
            <span style={{ color: meta.color, fontSize: 18 }}>{meta.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.toastTitle}>
                {t.user_name} — Hive {t.hive_id}
              </div>
              <div style={styles.toastMsg}>{t.message}</div>
            </div>
            <button style={styles.toastClose} onClick={() => onDismiss(t.id)}>
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AlertRow({ alert, onAcknowledge, onResolve, rowRef, isHighlighted }) {
  const meta = LEVEL_META[alert.alert_level] ?? LEVEL_META.info;
  const [busy, setBusy] = useState(false);

  const handle = async (action) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  return (
    <div
      ref={rowRef}
      style={{
        ...styles.alertRow,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderLeft: `4px solid ${meta.color}`,
        opacity: alert.resolved ? 0.55 : 1,
        animation: isHighlighted ? (meta.label === "CRITICAL" ? "glowFlashRed 1.2s ease 4" : meta.label === "WARNING" ? "glowFlashOrange 1.2s ease 4" : "glowFlashBlue 1.2s ease 4") : undefined,
      }}
    >
      <div style={styles.alertLevel}>
        <span style={{ color: meta.color, fontSize: 20 }}>{meta.icon}</span>
        <span style={{ ...styles.levelBadge, color: meta.color, borderColor: meta.border }}>
          {meta.label}
        </span>
      </div>

      <div style={styles.alertBody}>
        <div style={styles.alertMessage}>{alert.message}</div>
        <div style={styles.alertMeta}>
          <span>👤 {alert.user_name}</span>
          <span>🐝 {alert.hive_name}</span>
          {alert.sensor_value != null && <span>📊 {parseFloat(alert.sensor_value).toFixed(1)}</span>}
          <span>🕐 {fmtTime(alert.timestamp)}</span>
          {alert.acknowledged && <span style={{ color: "#8BC34A" }}>✓ Ack {fmtTime(alert.acknowledged_at)}</span>}
          {alert.resolved && <span style={{ color: "#66BB6A" }}>✅ Resolved {fmtTime(alert.resolved_at)}</span>}
        </div>
      </div>

      <div style={styles.alertActions}>
        {!alert.acknowledged && !alert.resolved && (
          <button
            style={{ ...styles.btn, ...styles.btnAck }}
            disabled={busy}
            onClick={() => handle(onAcknowledge)}
          >
            Acknowledge
          </button>
        )}
        {!alert.resolved && (
          <button
            style={{ ...styles.btn, ...styles.btnResolve }}
            disabled={busy}
            onClick={() => handle(onResolve)}
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [toasts, setToasts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState(null);
  const [ownerByHive, setOwnerByHive] = useState({});

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const alertRowRefs = useRef({});

  useEffect(() => {
    async function loadMeta() {
      const { data: userData } = await supabase
        .from("users")
        .select("user_id, first_name, last_name, email");

      const safeUsers = userData ?? [];
      const normalizedUsers = safeUsers.map((u) => ({
        ...u,
        name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || `User ${u.user_id}`,
      }));

      setUsers(normalizedUsers);
      setSelectedUserIds(normalizedUsers.map((u) => u.user_id));

      const { data: hiveData } = await supabase
        .from("beehives")
        .select("hive_id, owner_id, hive_code");

      const ownerMap = {};
      for (const hive of hiveData ?? []) {
        ownerMap[hive.hive_id] = {
          owner_id: hive.owner_id,
          hive_name: hive.hive_code || `Hive ${hive.hive_id}`,
        };
      }
      setOwnerByHive(ownerMap);
    }

    loadMeta();
  }, []);

  const fetchAlerts = useCallback(async () => {
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(200);

    if (!error && data) setAlerts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    if (highlightId) setFilter("all");
  }, [highlightId]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const timer = setTimeout(() => {
      const el = alertRowRefs.current[highlightId];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightId, loading]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-alerts-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newAlert = payload.new;
            const toastId = Date.now();
            setAlerts((prev) => [newAlert, ...prev]);
            setToasts((prev) => [...prev, { ...newAlert, id: toastId, user_name: "New user" }]);
            setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== toastId));
            }, 6000);
          }

          if (payload.eventType === "UPDATE") {
            setAlerts((prev) =>
              prev.map((a) => (a.alert_id === payload.new.alert_id ? payload.new : a))
            );
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const enrichedAlerts = useMemo(() => {
    const userNameMap = Object.fromEntries(users.map((u) => [u.user_id, u.name]));

    return alerts.map((alert) => {
      const hiveMeta = ownerByHive[alert.hive_id] ?? {};
      return {
        ...alert,
        owner_id: hiveMeta.owner_id ?? null,
        hive_name: hiveMeta.hive_name ?? `Hive ${alert.hive_id}`,
        user_name: userNameMap[hiveMeta.owner_id] ?? "Unknown User",
      };
    });
  }, [alerts, ownerByHive, users]);

  const acknowledge = async (alertId) => {
    const now = new Date().toISOString();
    setAlerts((prev) =>
      prev.map((a) =>
        a.alert_id === alertId ? { ...a, acknowledged: true, acknowledged_at: now } : a
      )
    );

    const { error } = await supabase
      .from("alerts")
      .update({ acknowledged: true, acknowledged_at: now })
      .eq("alert_id", alertId);

    if (error) {
      console.error("Acknowledge failed:", error);
    }
  };

  const resolve = async (alertId) => {
    const now = new Date().toISOString();
    setAlerts((prev) =>
      prev.map((a) =>
        a.alert_id === alertId
          ? { ...a, resolved: true, resolved_at: now, acknowledged: true, acknowledged_at: a.acknowledged_at ?? now }
          : a
      )
    );

    const { error } = await supabase
      .from("alerts")
      .update({ resolved: true, resolved_at: now, acknowledged: true, acknowledged_at: now })
      .eq("alert_id", alertId);

    if (error) {
      console.error("Resolve failed:", error);
    }
  };

  const visibleAlerts = enrichedAlerts.filter((alert) => {
    if (selectedUserIds !== null && !selectedUserIds.includes(alert.owner_id)) return false;
    if (filter === "unresolved") return !alert.resolved;
    if (filter === "all") return true;
    return alert.alert_level === filter;
  });

  const counts = {
    critical: enrichedAlerts.filter((a) => a.alert_level === "critical" && !a.resolved).length,
    warning: enrichedAlerts.filter((a) => a.alert_level === "warning" && !a.resolved).length,
    info: enrichedAlerts.filter((a) => a.alert_level === "info" && !a.resolved).length,
  };

  const userIds = users.map((u) => u.user_id);
  const userNameMap = Object.fromEntries(users.map((u) => [u.user_id, u.name]));

  function toggleUser(id) {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <>
      <Box sx={{ minHeight: "100vh", bgcolor: "#fff9e9" }}>
        <AdminNavBar />
      <Toast toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      <Box sx={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>🐝 Alert Center</h1>
            <p style={styles.subtitle}>All users and all hive alerts</p>
          </div>

          <div style={styles.summaryRow}>
            {Object.entries(counts).map(([level, count]) => {
              const meta = LEVEL_META[level] ?? LEVEL_META.info;
              return (
                <div
                  key={level}
                  style={{
                    ...styles.summaryBadge,
                    borderColor: meta.border,
                    background: meta.bg,
                  }}
                >
                  <span style={{ color: meta.color, fontWeight: 700, fontSize: 22 }}>{count}</span>
                  <span style={{ color: meta.color, fontSize: 11, letterSpacing: 1 }}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, md: 2 },
            mb: 2,
            border: "2px solid black",
            borderRadius: "11px",
            bgcolor: "#fff9e9",
          }}
        >
          <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
            <Typography
              fontFamily="Inter, sans-serif"
              fontSize={13}
              fontWeight={600}
              color="text.secondary"
            >
              Filter by user
            </Typography>
            {selectedUserIds !== null && (
              <MultiSelectFilter
                label="Users"
                options={userIds}
                selected={selectedUserIds}
                onToggle={toggleUser}
                onSelectAll={() => setSelectedUserIds([...userIds])}
                onClearAll={() => setSelectedUserIds([])}
                getLabel={(id) => userNameMap[id] ?? `User ${id}`}
              />
            )}
          </Stack>
        </Paper>

        <div style={styles.filterRow}>
          {["all", "unresolved", "critical", "warning", "info"].map((f) => (
            <button
              key={f}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "unresolved" ? "Unresolved" : (LEVEL_META[f]?.label ?? f)}
            </button>
          ))}
        </div>

        <div style={styles.list}>
          {loading ? (
            <div style={styles.empty}>Loading alerts…</div>
          ) : visibleAlerts.length === 0 ? (
            <div style={styles.empty}>
              {filter === "unresolved" ? "✅ All clear — no unresolved alerts!" : "No alerts found."}
            </div>
          ) : (
            visibleAlerts.map((alert) => (
              <AlertRow
                key={alert.alert_id}
                alert={alert}
                rowRef={(el) => {
                  if (el) alertRowRefs.current[String(alert.alert_id)] = el;
                }}
                isHighlighted={String(alert.alert_id) === highlightId}
                onAcknowledge={() => acknowledge(alert.alert_id)}
                onResolve={() => resolve(alert.alert_id)}
              />
            ))
          )}
        </div>
      </Box>

      <Footer />
      </Box>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes glowFlashRed {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 20px 6px rgba(255,77,77,0.7); }
        }
        @keyframes glowFlashOrange {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 20px 6px rgba(254,152,5,0.7); }
        }
        @keyframes glowFlashBlue {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 20px 6px rgba(77,166,255,0.7); }
        }
      `}</style>
    </>
  );
}

const styles = {
  page: {
    maxWidth: 1000,
    margin: "0 auto",
    padding: "24px 16px 40px",
    fontFamily: "inherit",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: "var(--text, #1a1a1a)",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 14,
    color: "var(--text-muted, #888)",
  },
  summaryRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  summaryBadge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid",
    minWidth: 70,
    gap: 2,
  },
  filterRow: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  filterBtn: {
    padding: "6px 16px",
    borderRadius: 20,
    border: "1px solid var(--outline, #ddd)",
    background: "transparent",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text, #444)",
    fontWeight: 500,
    transition: "all 0.15s",
  },
  filterBtnActive: { background: "#FE9805", borderColor: "#FE9805", color: "#fff" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  alertRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    borderRadius: 10,
    flexWrap: "wrap",
    transition: "opacity 0.2s",
  },
  alertLevel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    minWidth: 64,
  },
  levelBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    border: "1px solid",
    borderRadius: 4,
    padding: "1px 5px",
  },
  alertBody: { flex: 1, minWidth: 180 },
  alertMessage: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text, #1a1a1a)",
    marginBottom: 4,
  },
  alertMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    fontSize: 12,
    color: "var(--text-muted, #888)",
  },
  alertActions: { display: "flex", gap: 8, flexShrink: 0 },
  btn: {
    padding: "6px 14px",
    borderRadius: 7,
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    transition: "opacity 0.15s",
  },
  btnAck: {
    background: "rgba(254,152,5,0.15)",
    color: "#FE9805",
    border: "1px solid rgba(254,152,5,0.4)",
  },
  btnResolve: {
    background: "rgba(102,187,106,0.15)",
    color: "#4CAF50",
    border: "1px solid rgba(102,187,106,0.4)",
  },
  toastContainer: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxWidth: 360,
    width: "100%",
  },
  toast: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "14px 16px",
    borderRadius: 10,
    background: "var(--bg, #fff)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
    border: "1px solid var(--outline, #eee)",
  },
  toastTitle: { fontWeight: 700, fontSize: 13, color: "var(--text, #1a1a1a)", marginBottom: 2 },
  toastMsg: {
    fontSize: 12,
    color: "var(--text-muted, #888)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  toastClose: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-muted, #aaa)",
    fontSize: 14,
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
  empty: {
    textAlign: "center",
    padding: "60px 0",
    color: "var(--text-muted, #aaa)",
    fontSize: 15,
  },
};
