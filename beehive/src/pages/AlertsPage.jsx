import { useEffect, useState, useCallback } from "react";
import { supabase } from "../createClient";

// ─── Config ─────────────────────────────────────────────────────────────────
const HIVE_ID = 41; // hardcoded until auth is ready

// ─── helpers ────────────────────────────────────────────────────────────────

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
  offline: {
    color: "#9E9E9E",
    bg: "rgba(158,158,158,0.10)",
    border: "rgba(158,158,158,0.35)",
    label: "OFFLINE",
    icon: "📡",
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

// ─── Toast ──────────────────────────────────────────────────────────────────

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
                Hive {t.hive_id} — {meta.label}
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

// ─── Alert row ──────────────────────────────────────────────────────────────

function AlertRow({ alert, onAcknowledge, onResolve }) {
  const meta = LEVEL_META[alert.alert_level] ?? LEVEL_META.info;
  const [busy, setBusy] = useState(false);

  const handle = async (action) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  return (
    <div
      style={{
        ...styles.alertRow,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderLeft: `4px solid ${meta.color}`,
        opacity: alert.resolved ? 0.55 : 1,
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
          <span>🐝 Hive {alert.hive_id}</span>
          {alert.sensor_value != null && (
            <span>📊 {parseFloat(alert.sensor_value).toFixed(1)}</span>
          )}
          <span>🕐 {fmtTime(alert.timestamp)}</span>
          {alert.acknowledged && (
            <span style={{ color: "#8BC34A" }}>✓ Ack {fmtTime(alert.acknowledged_at)}</span>
          )}
          {alert.resolved && (
            <span style={{ color: "#66BB6A" }}>✅ Resolved {fmtTime(alert.resolved_at)}</span>
          )}
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

// ─── Offline row ─────────────────────────────────────────────────────────────

function OfflineRow({ notification }) {
  const meta = LEVEL_META.offline;
  const isPending = notification.delivery_status === "pending";

  return (
    <div
      style={{
        ...styles.alertRow,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderLeft: `4px solid ${meta.color}`,
        opacity: isPending ? 1 : 0.55,
      }}
    >
      <div style={styles.alertLevel}>
        <span style={{ color: meta.color, fontSize: 20 }}>{meta.icon}</span>
        <span style={{ ...styles.levelBadge, color: meta.color, borderColor: meta.border }}>
          {meta.label}
        </span>
      </div>

      <div style={styles.alertBody}>
        <div style={styles.alertMessage}>
          Sensor {notification.sensor_id} — no data received
        </div>
        <div style={styles.alertMeta}>
          <span>🐝 Hive {notification.hive_id}</span>
          <span>🕐 Last seen: {fmtTime(notification.last_reading_timestamp)}</span>
          <span
            style={{
              color: isPending ? "#FE9805" : "#66BB6A",
              fontWeight: 600,
            }}
          >
            {isPending ? "⏳ Pending" : "✅ Delivered"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [offline, setOffline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [toasts, setToasts] = useState([]);

  // ── fetch alerts ──
  const fetchAlerts = useCallback(async () => {
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("hive_id", HIVE_ID)
      .order("timestamp", { ascending: false })
      .limit(200);

    if (!error && data) setAlerts(data);
    setLoading(false);
  }, []);

  // ── fetch offline notifications ──
  const fetchOffline = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("hive_id", HIVE_ID)
      .eq("notification_type", "no_data")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) setOffline(data);
  }, []);

  useEffect(() => {
    fetchAlerts();
    fetchOffline();
  }, [fetchAlerts, fetchOffline]);

  // ── realtime ──
  useEffect(() => {
    const channel = supabase
      .channel("alerts-page-live")
      // alerts table
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts", filter: `hive_id=eq.${HIVE_ID}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newAlert = payload.new;
            setAlerts((prev) => [newAlert, ...prev]);
            const toastId = Date.now();
            setToasts((prev) => [...prev, { ...newAlert, id: toastId }]);
            setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 6000);
          }
          if (payload.eventType === "UPDATE") {
            setAlerts((prev) =>
              prev.map((a) => (a.alert_id === payload.new.alert_id ? payload.new : a))
            );
          }
        }
      )
      // notifications table (sensor offline)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `hive_id=eq.${HIVE_ID}` },
        (payload) => {
          const n = payload.new;
          if (n.notification_type !== "no_data") return;
          setOffline((prev) => [n, ...prev]);
          const toastId = Date.now();
          setToasts((prev) => [
            ...prev,
            {
              id: toastId,
              hive_id: n.hive_id,
              alert_level: "warning",
              message: `Sensor ${n.sensor_id} offline — last seen ${fmtTime(n.last_reading_timestamp)}`,
            },
          ]);
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 6000);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ── actions ──
  const acknowledge = async (alertId) => {
    await supabase
      .from("alerts")
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq("alert_id", alertId);
  };

  const resolve = async (alertId) => {
    await supabase
      .from("alerts")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("alert_id", alertId);
  };

  // ── filter ──
  const filtered = (() => {
    if (filter === "offline") return [];
    if (filter === "unresolved") return alerts.filter((a) => !a.resolved);
    if (filter === "all") return alerts;
    return alerts.filter((a) => a.alert_level === filter);
  })();

  const showOffline = filter === "all" || filter === "offline";

  // ── counts ──
  const counts = {
    critical: alerts.filter((a) => a.alert_level === "critical" && !a.resolved).length,
    warning: alerts.filter((a) => a.alert_level === "warning" && !a.resolved).length,
    info: alerts.filter((a) => a.alert_level === "info" && !a.resolved).length,
    offline: offline.filter((n) => n.delivery_status === "pending").length,
  };

  return (
    <>
      <Toast toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>🐝 Alert Center</h1>
            <p style={styles.subtitle}>Hive {HIVE_ID} — live monitoring</p>
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

        {/* Filter tabs */}
        <div style={styles.filterRow}>
          {["all", "unresolved", "critical", "warning", "info", "offline"].map((f) => (
            <button
              key={f}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? "All"
                : f === "unresolved"
                ? "Unresolved"
                : (LEVEL_META[f]?.label ?? f)}
            </button>
          ))}
        </div>

        {/* Alert list */}
        <div style={styles.list}>
          {loading ? (
            <div style={styles.empty}>Loading alerts…</div>
          ) : (
            <>
              {/* Offline sensor rows */}
              {showOffline &&
                offline.map((n, i) => <OfflineRow key={i} notification={n} />)}

              {/* Regular alerts */}
              {filtered.length === 0 && !showOffline ? (
                <div style={styles.empty}>
                  {filter === "unresolved" ? "✅ All clear — no unresolved alerts!" : "No alerts found."}
                </div>
              ) : (
                filtered.map((alert) => (
                  <AlertRow
                    key={alert.alert_id}
                    alert={alert}
                    onAcknowledge={() => acknowledge(alert.alert_id)}
                    onResolve={() => resolve(alert.alert_id)}
                  />
                ))
              )}

              {showOffline && offline.length === 0 && filtered.length === 0 && (
                <div style={styles.empty}>✅ All clear — no alerts!</div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  page: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "8px 0 40px",
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
  summaryRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
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
  filterRow: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
    flexWrap: "wrap",
  },
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
  filterBtnActive: {
    background: "#FE9805",
    borderColor: "#FE9805",
    color: "#fff",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
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
  alertBody: {
    flex: 1,
    minWidth: 180,
  },
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
  alertActions: {
    display: "flex",
    gap: 8,
    flexShrink: 0,
  },
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
  toastTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: "var(--text, #1a1a1a)",
    marginBottom: 2,
  },
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
