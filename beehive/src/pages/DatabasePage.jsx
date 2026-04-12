import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../createClient";
import { useAuth } from "../context/AuthContext";
import { NavBar } from "../components/HiveOverviewUI";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS = [
  { id: "timestamp",   label: "Timestamp",   sortable: true  },
  { id: "hive_name",   label: "Hive",        sortable: true  },
  { id: "sensor_type", label: "Sensor Type", sortable: true  },
  { id: "sensor_id",   label: "Sensor ID",   sortable: true  },
  { id: "value",       label: "Value",       sortable: true  },
  { id: "unit",        label: "Unit",        sortable: false },
  { id: "is_valid",    label: "Valid",       sortable: false },
];

const ROW_LIMIT = 1000;

// ─── Multi-select filter button ───────────────────────────────────────────────

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
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={someSelected}
            sx={{ p: 0.5 }}
          />
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

// ─── Sort indicator ───────────────────────────────────────────────────────────

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpwardIcon sx={{ fontSize: 14, opacity: 0.2, ml: 0.5 }} />;
  return sortDir === "asc"
    ? <ArrowUpwardIcon sx={{ fontSize: 14, color: "#FE9805", ml: 0.5 }} />
    : <ArrowDownwardIcon sx={{ fontSize: 14, color: "#FE9805", ml: 0.5 }} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DatabasePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedHiveId = searchParams.get("hive")
    ? Number(searchParams.get("hive"))
    : null;

  // Meta
  const [userHives, setUserHives] = useState([]);   // [{ hive_id, name }]
  const [sensorMeta, setSensorMeta] = useState({}); // sensor_id -> { hive_id, hive_name, sensor_type, unit }
  const [availableTypes, setAvailableTypes] = useState([]);
  const [metaLoaded, setMetaLoaded] = useState(false);

  // Filters
  const [selectedHiveIds, setSelectedHiveIds] = useState(null); // null until meta loaded
  const [selectedTypes, setSelectedTypes] = useState([]);       // [] = all
  const [startDate, setStartDate] = useState(dayjs().subtract(7, "day"));
  const [endDate, setEndDate] = useState(dayjs());
  const [showInvalid, setShowInvalid] = useState(false);

  // Data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(null);

  // Sort
  const [sortCol, setSortCol] = useState("timestamp");
  const [sortDir, setSortDir] = useState("desc");

  // UI
  const [exportAnchor, setExportAnchor] = useState(null);

  // ── Load hive + sensor metadata ──────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    async function loadMeta() {
      const { data: userData } = await supabase
        .from("users")
        .select("user_id")
        .eq("email", user.email)
        .single();
      if (!userData) return;

      const { data: hiveData } = await supabase
        .from("beehives")
        .select("hive_id, hive_code")
        .eq("owner_id", userData.user_id);

      const hives = (hiveData ?? []).map((h) => ({
        hive_id: h.hive_id,
        name: h.hive_code || `Hive ${h.hive_id}`,
      }));
      setUserHives(hives);

      // Initialize hive filter from URL param or select all
      setSelectedHiveIds(
        preselectedHiveId !== null
          ? [preselectedHiveId]
          : hives.map((h) => h.hive_id)
      );

      const hiveIds = hives.map((h) => h.hive_id);
      if (hiveIds.length === 0) { setMetaLoaded(true); return; }

      const { data: boards } = await supabase
        .from("iot_boards")
        .select("board_id, hive_id")
        .in("hive_id", hiveIds);

      const boardIds = (boards ?? []).map((b) => b.board_id);
      const boardToHive = Object.fromEntries((boards ?? []).map((b) => [b.board_id, b.hive_id]));
      const hiveNameMap = Object.fromEntries(hives.map((h) => [h.hive_id, h.name]));

      if (boardIds.length === 0) { setMetaLoaded(true); return; }

      const { data: sensors } = await supabase
        .from("sensors")
        .select("sensor_id, board_id, sensor_type, unit")
        .in("board_id", boardIds);

      const meta = {};
      const typeSet = new Set();
      for (const s of sensors ?? []) {
        const hiveId = boardToHive[s.board_id];
        meta[s.sensor_id] = {
          hive_id: hiveId,
          hive_name: hiveNameMap[hiveId] ?? `Hive ${hiveId}`,
          sensor_type: s.sensor_type ?? "unknown",
          unit: s.unit ?? "",
        };
        if (s.sensor_type) typeSet.add(s.sensor_type);
      }
      setSensorMeta(meta);
      setAvailableTypes([...typeSet].sort());
      setMetaLoaded(true);
    }
    loadMeta();
  }, [user]);

  // ── Fetch readings when filters change ───────────────────────────────────

  const fetchReadings = useCallback(async () => {
    if (!metaLoaded || selectedHiveIds === null) return;
    setLoading(true);
    try {
      // Derive sensor IDs that match current hive + type filters
      const sensorIds = Object.entries(sensorMeta)
        .filter(([, m]) => {
          if (!selectedHiveIds.includes(m.hive_id)) return false;
          if (selectedTypes.length > 0 && !selectedTypes.includes(m.sensor_type)) return false;
          return true;
        })
        .map(([id]) => Number(id));

      if (sensorIds.length === 0) {
        setRows([]);
        setTotalCount(0);
        return;
      }

      let query = supabase
        .from("sensor_readings")
        .select("sensor_id, value, unit, timestamp, is_valid", { count: "exact" })
        .in("sensor_id", sensorIds)
        .gte("timestamp", startDate.startOf("day").toISOString())
        .lte("timestamp", endDate.endOf("day").toISOString())
        .order("timestamp", { ascending: false })
        .limit(ROW_LIMIT);

      if (!showInvalid) query = query.eq("is_valid", true);

      const { data, error, count } = await query;
      if (error) throw error;

      const denormalized = (data ?? []).map((r) => ({
        ...r,
        ...(sensorMeta[r.sensor_id] ?? { hive_name: "—", sensor_type: "—", unit: r.unit ?? "" }),
      }));

      setRows(denormalized);
      setTotalCount(count ?? 0);
    } catch (e) {
      console.error("Failed to fetch readings:", e);
    } finally {
      setLoading(false);
    }
  }, [metaLoaded, selectedHiveIds, selectedTypes, startDate, endDate, showInvalid, sensorMeta]);

  useEffect(() => { fetchReadings(); }, [fetchReadings]);

  // ── Sort ─────────────────────────────────────────────────────────────────

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  function handleSort(col) {
    if (!COLUMNS.find((c) => c.id === col)?.sortable) return;
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function triggerDownload(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const header = COLUMNS.map((c) => c.label).join(",");
    const csvRows = sortedRows.map((r) =>
      COLUMNS.map((c) => {
        let v;
        if (c.id === "timestamp") v = dayjs(r.timestamp).format("YYYY-MM-DD HH:mm:ss");
        else if (c.id === "is_valid") v = r.is_valid ? "yes" : "no";
        else v = r[c.id] ?? "";
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(",")
    );
    triggerDownload([header, ...csvRows].join("\n"), "sensor_data.csv", "text/csv");
    setExportAnchor(null);
  }

  function exportJSON() {
    const payload = sortedRows.map((r) => ({
      timestamp: r.timestamp,
      hive: r.hive_name,
      sensor_type: r.sensor_type,
      sensor_id: r.sensor_id,
      value: r.value,
      unit: r.unit,
      is_valid: r.is_valid,
    }));
    triggerDownload(JSON.stringify(payload, null, 2), "sensor_data.json", "application/json");
    setExportAnchor(null);
  }

  // ── Filter helpers ────────────────────────────────────────────────────────

  const hiveIds = userHives.map((h) => h.hive_id);
  const hiveNameMap = Object.fromEntries(userHives.map((h) => [h.hive_id, h.name]));

  function toggleHive(id) {
    setSelectedHiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleType(t) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  const activeFilterCount =
    (selectedHiveIds !== null && selectedHiveIds.length < hiveIds.length ? 1 : 0) +
    (selectedTypes.length > 0 ? 1 : 0) +
    (showInvalid ? 1 : 0);

  function resetFilters() {
    setSelectedHiveIds(hiveIds);
    setSelectedTypes([]);
    setStartDate(dayjs().subtract(7, "day"));
    setEndDate(dayjs());
    setShowInvalid(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff9e9" }}>
      <NavBar />

      <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, py: 3 }}>
        <Typography
          fontFamily="Poppins, sans-serif"
          fontWeight={700}
          fontSize={{ xs: 22, md: 28 }}
          mb={2}
        >
          Sensor Database
        </Typography>

        {/* ── Filter bar ── */}
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
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={1.5}
            alignItems="center"
          >
            <Stack direction="row" alignItems="center" gap={0.5}>
              <FilterListIcon sx={{ fontSize: 18, color: activeFilterCount > 0 ? "#FE9805" : "text.secondary" }} />
              <Typography fontFamily="Inter, sans-serif" fontSize={13} fontWeight={600} color="text.secondary">
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Typography>
            </Stack>

            {/* Hive filter */}
            {selectedHiveIds !== null && (
              <MultiSelectFilter
                label="Hives"
                options={hiveIds}
                selected={selectedHiveIds}
                onToggle={toggleHive}
                onSelectAll={() => setSelectedHiveIds([...hiveIds])}
                onClearAll={() => setSelectedHiveIds([])}
                getLabel={(id) => hiveNameMap[id] ?? `Hive ${id}`}
              />
            )}

            {/* Sensor type filter */}
            {availableTypes.length > 0 && (
              <MultiSelectFilter
                label="Sensor Type"
                options={availableTypes}
                selected={selectedTypes.length === 0 ? availableTypes : selectedTypes}
                onToggle={(t) => {
                  // When none selected it means "all"; toggling one off means filtering
                  if (selectedTypes.length === 0) {
                    setSelectedTypes(availableTypes.filter((x) => x !== t));
                  } else {
                    toggleType(t);
                    if (selectedTypes.length === 1 && selectedTypes[0] === t) setSelectedTypes([]);
                  }
                }}
                onSelectAll={() => setSelectedTypes([])}
                onClearAll={() => setSelectedTypes(availableTypes.slice(0, 0))}
                getLabel={(t) => t}
              />
            )}

            {/* Date range */}
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="From"
                value={startDate}
                onChange={(v) => v?.isValid() && setStartDate(v)}
                disableFuture
                slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
              />
              <DatePicker
                label="To"
                value={endDate}
                onChange={(v) => v?.isValid() && setEndDate(v)}
                disableFuture
                slotProps={{ textField: { size: "small", sx: { width: 150 } } }}
              />
            </LocalizationProvider>

            {/* Show invalid */}
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={showInvalid}
                  onChange={(e) => setShowInvalid(e.target.checked)}
                />
              }
              label={<Typography fontSize={13} fontFamily="Inter, sans-serif">Show invalid</Typography>}
              sx={{ m: 0 }}
            />

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Reset */}
            {activeFilterCount > 0 && (
              <Button
                size="small"
                onClick={resetFilters}
                sx={{ color: "error.main", textTransform: "none", fontFamily: "Inter, sans-serif", fontSize: 13 }}
              >
                Reset
              </Button>
            )}

            {/* Export */}
            <Button
              variant="contained"
              size="small"
              startIcon={<FileDownloadIcon />}
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => setExportAnchor(e.currentTarget)}
              disabled={sortedRows.length === 0}
              sx={{
                bgcolor: "#FE9805",
                color: "black",
                textTransform: "none",
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                "&:hover": { bgcolor: "#e08900" },
              }}
            >
              Export
            </Button>
            <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
              <MenuItem onClick={exportCSV}>
                <Typography fontFamily="Inter, sans-serif" fontSize={14}>Download as CSV</Typography>
              </MenuItem>
              <MenuItem onClick={exportJSON}>
                <Typography fontFamily="Inter, sans-serif" fontSize={14}>Download as JSON</Typography>
              </MenuItem>
            </Menu>
          </Stack>
        </Paper>

        {/* ── Row count / limit warning ── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography fontFamily="Inter, sans-serif" fontSize={13} color="text.secondary">
            {loading
              ? "Loading…"
              : `Showing ${sortedRows.length.toLocaleString()}${totalCount !== null && totalCount > ROW_LIMIT ? ` of ${totalCount.toLocaleString()}` : ""} rows`}
          </Typography>
          {totalCount !== null && totalCount > ROW_LIMIT && (
            <Tooltip title="Narrow your date range or apply filters to see all data">
              <Typography fontFamily="Inter, sans-serif" fontSize={12} color="warning.main" fontWeight={600}>
                ⚠ Showing first {ROW_LIMIT.toLocaleString()} rows — {totalCount.toLocaleString()} total match your filters
              </Typography>
            </Tooltip>
          )}
        </Stack>

        {/* ── Table ── */}
        <Paper
          variant="outlined"
          sx={{ border: "2px solid black", borderRadius: "11px", overflow: "hidden" }}
        >
          <TableContainer sx={{ maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {COLUMNS.map((col) => (
                    <TableCell
                      key={col.id}
                      onClick={() => handleSort(col.id)}
                      sx={{
                        bgcolor: "#fbc139",
                        fontFamily: "Poppins, sans-serif",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: col.sortable ? "pointer" : "default",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        "&:hover": col.sortable ? { bgcolor: "#f0b830" } : {},
                        borderBottom: "2px solid black",
                      }}
                    >
                      <Stack direction="row" alignItems="center">
                        {col.label}
                        {col.sortable && <SortIcon col={col.id} sortCol={sortCol} sortDir={sortDir} />}
                      </Stack>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} sx={{ color: "#FE9805" }} />
                    </TableCell>
                  </TableRow>
                ) : sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 6 }}>
                      <Typography fontFamily="Inter, sans-serif" color="text.secondary" fontSize={14}>
                        No readings found for the selected filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map((row, i) => (
                    <TableRow
                      key={`${row.sensor_id}-${row.timestamp}-${i}`}
                      sx={{
                        bgcolor: i % 2 === 0 ? "#fff9e9" : "#fffdf4",
                        "&:hover": { bgcolor: "rgba(254,152,5,0.08)" },
                      }}
                    >
                      <TableCell sx={{ fontFamily: "Inter, sans-serif", fontSize: 13, whiteSpace: "nowrap" }}>
                        {dayjs(row.timestamp).format("MMM D, YYYY h:mm A")}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                        {row.hive_name}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "Inter, sans-serif", fontSize: 13, textTransform: "capitalize" }}>
                        {row.sensor_type}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                        {row.sensor_id}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                        {row.value != null ? Number(row.value).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                        {row.unit ?? "—"}
                      </TableCell>
                      <TableCell sx={{ fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                        <Box
                          component="span"
                          sx={{
                            display: "inline-block",
                            px: 1,
                            py: 0.25,
                            borderRadius: "4px",
                            fontSize: 11,
                            fontWeight: 700,
                            bgcolor: row.is_valid ? "rgba(102,187,106,0.15)" : "rgba(255,77,77,0.10)",
                            color: row.is_valid ? "#4CAF50" : "#FF4D4D",
                            border: `1px solid ${row.is_valid ? "rgba(102,187,106,0.4)" : "rgba(255,77,77,0.35)"}`,
                          }}
                        >
                          {row.is_valid ? "valid" : "invalid"}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
}
