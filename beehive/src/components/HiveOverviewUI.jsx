import React, { useState, useMemo, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../createClient";
import {
  AppBar,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuIcon from "@mui/icons-material/Menu";
import DubaiLogo from "../assets/DubaiLogo.png";
import overviewBg from "../assets/overviewBackground.png";
import Footer from "./Footer";

function HiveAvatar({ hive, onEditClick }) {
  const [hovered, setHovered] = useState(false);

  const imageSrc = hive.avatarUrl || hive.fallbackIcon;
  const bgColor = hive.avatarBgColor ?? "#FE9805";

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.preventDefault(); onEditClick?.(); }}
      sx={{
        width: "100%",
        height: "100%",
        border: "2px solid black",
        borderRadius: "11px",
        backgroundColor: bgColor,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      <Box
        component="img"
        src={imageSrc}
        alt={`${hive.name} avatar`}
        sx={{ width: "72%", height: "72%", objectFit: "contain" }}
      />

      {hovered && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "black" }}>
            edit
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function HiveEditDialog({ hive, open, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(hive?.name ?? "");
      setImageFile(null);
      setPreviewUrl(hive?.avatarUrl ?? null);
      setError(null);
    }
  }, [open, hive]);

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updates = {};

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${hive.hive_id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("hive-avatars")
          .upload(path, imageFile, { upsert: true });
        if (uploadError) throw uploadError;
        updates.avatar_storage_path = path;
        updates.avatar_type = "custom";
      }

      if (name.trim() && name.trim() !== hive.name) {
        updates.hive_code = name.trim();
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("beehives")
          .update(updates)
          .eq("hive_id", hive.hive_id);
        if (updateError) throw updateError;
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontFamily="Poppins, sans-serif" fontWeight={600}>
        Edit Hive
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Preview */}
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <Box
              sx={{
                width: 100,
                height: 100,
                borderRadius: "11px",
                border: "2px solid black",
                backgroundColor: hive?.avatarBgColor ?? "#FE9805",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {previewUrl ? (
                <Box
                  component="img"
                  src={previewUrl}
                  sx={{ width: "72%", height: "72%", objectFit: "contain" }}
                />
              ) : (
                <Typography fontSize={12} color="text.secondary">No image</Typography>
              )}
            </Box>
          </Box>

          {/* Drag & drop / file picker */}
          <Box
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: `2px dashed ${dragging ? "#FE9805" : "#ccc"}`,
              borderRadius: "8px",
              p: 3,
              textAlign: "center",
              cursor: "pointer",
              bgcolor: dragging ? "rgba(254,152,5,0.07)" : "transparent",
              transition: "border-color 0.2s, background-color 0.2s",
            }}
          >
            <Typography fontSize={14} color="text.secondary">
              Drag & drop an image, or{" "}
              <Box component="span" sx={{ color: "#FE9805", fontWeight: 600 }}>
                browse files
              </Box>
            </Typography>
            {imageFile && (
              <Typography fontSize={12} sx={{ mt: 0.5, color: "text.primary" }}>
                {imageFile.name}
              </Typography>
            )}
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {/* Name */}
          <TextField
            label="Hive Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            fullWidth
          />

          {error && (
            <Typography color="error" fontSize={13}>{error}</Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: "black" }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          sx={{ bgcolor: "#FE9805", "&:hover": { bgcolor: "#e08900" }, color: "black" }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function NavBar({
  appTitle = "DUBAI Hive Monitoring",
  centerTitle,
  onDatabaseClick,
  onSettingsClick,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const useHamburgerNav = useMediaQuery(theme.breakpoints.down("md"));
  const [hamburgerAnchor, setHamburgerAnchor] = useState(null);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const navItems = [
    { label: "Alerts",   onClick: () => navigate("/alerts"),   path: "/alerts"   },
    { label: "Database", onClick: onDatabaseClick ?? (() => navigate("/database")), path: "/database" },
    { label: "Settings", onClick: onSettingsClick ?? (() => navigate("/settings")), path: "/settings" },
    { label: "Logout",   onClick: handleLogout,                path: "/login"    },
  ];

  const isActive = (path) => path && location.pathname === path;

  return (
    <AppBar position="sticky" elevation={4} sx={{ top: 0, zIndex: 1100, bgcolor: "#fbc139", color: "black" }}>
      <Toolbar sx={{ px: { xs: 2, sm: 7 }, position: "relative" }}>
        {centerTitle && (
          <Typography
            fontFamily="Poppins, sans-serif"
            fontWeight={700}
            sx={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: { xs: 16, sm: 20, md: 22 },
              color: "#fff",
              pointerEvents: "none",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {centerTitle}
          </Typography>
        )}

        {/* Brand link / mobile back button */}
        <Box sx={{ flexGrow: 1 }}>
          {isMobile ? (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              sx={{
                color: "black",
                textTransform: "none",
                fontFamily: "Poppins, sans-serif",
                fontWeight: 700,
                fontSize: 14,
                minWidth: 0,
                pl: 0,
              }}
            >
              Back
            </Button>
          ) : (
            <Typography
              component={Link}
              to="/hives"
              fontFamily="Poppins, sans-serif"
              fontWeight={700}
              sx={{
                display: "inline-flex",
                width: "fit-content",
                fontSize: { xs: 14, sm: 16, md: 18 },
                color: isActive("/hives") ? "#fff" : "#000",
                textDecoration: isActive("/hives") ? "underline" : "none",
                textUnderlineOffset: "4px",
                "&:hover": { textDecoration: "underline", opacity: 0.9 },
              }}
            >
              {appTitle}
            </Typography>
          )}
        </Box>

        {useHamburgerNav ? (
          <>
            <IconButton
              onClick={(e) => setHamburgerAnchor(e.currentTarget)}
              sx={{ color: "white" }}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={hamburgerAnchor}
              open={Boolean(hamburgerAnchor)}
              onClose={() => setHamburgerAnchor(null)}
            >
              {navItems.map(({ label, onClick, path }) => (
                <MenuItem
                  key={label}
                  onClick={() => { setHamburgerAnchor(null); onClick?.(); }}
                  sx={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: isActive(path) ? 700 : 500,
                    color: isActive(path) ? "#FE9805" : "inherit",
                  }}
                >
                  {label}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <Stack direction="row" spacing={{ sm: 3, md: 4 }}>
            {navItems.map(({ label, onClick, path }) => {
              const active = isActive(path);
              return (
                <Typography
                  key={label}
                  component="span"
                  fontFamily="Inter, sans-serif"
                  fontWeight={active ? 700 : 400}
                  fontSize={14}
                  sx={{
                    cursor: "pointer",
                    color: active ? "#fff" : "#000",
                    textDecoration: active ? "underline" : "none",
                    textUnderlineOffset: "4px",
                    "&:hover": { color: "#fff", textDecoration: "underline" },
                  }}
                  onClick={onClick}
                >
                  {label}
                </Typography>
              );
            })}
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}

function StatCard({ label, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: { xs: 1.5, sm: 2.5, md: 4 },
        py: { xs: 1, sm: 1.5, md: 3 },
        bgcolor: "#fff9e9",
        border: "2px solid black",
        borderRadius: "11px",
      }}
    >
      <Typography
        fontFamily="Inter, sans-serif"
        fontWeight={600}
        fontSize={{ xs: 11, sm: 13, md: 16 }}
        textAlign="center"
      >
        {label}: {value}
      </Typography>
    </Paper>
  );
}

function HiveCard({ hive, onEditClick }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  // Card dimensions
  const cardW = isMobile ? "100%" : isTablet ? 220 : 283;
  const cardH = isMobile ? 160 : isTablet ? 148 : 191;
  const cardMaxW = isMobile ? 420 : undefined;

  // Internal layout positions
  const nameTop = isMobile ? 12 : isTablet ? 14 : 18;
  const nameLeft = isMobile ? 14 : isTablet ? 15 : 19;
  const nameFontSize = isTablet ? 16 : isMobile ? 16 : 20;

  const avatarSize = isMobile ? 96 : isTablet ? 84 : 108;
  const avatarTop = isMobile ? 38 : isTablet ? 44 : 58;
  const avatarLeft = isMobile ? 14 : isTablet ? 16 : 21;

  const infoTop = isMobile ? 42 : isTablet ? 48 : 64;
  const infoLeft = avatarLeft + avatarSize + 10;
  const infoFontSize = isTablet ? 11 : isMobile ? 12 : 12;

  return (
    <Paper
      component={Link}
      to={`/hives/${hive.hive_id}`}
      variant="outlined"
      sx={{
        width: cardW,
        maxWidth: cardMaxW,
        height: cardH,
        bgcolor: "#fff9e9",
        border: "2px solid black",
        borderRadius: "11px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0px 4px 4px rgba(0,0,0,0.25)",
        flexShrink: 0,
        textDecoration: "none",
        color: "inherit",
        display: "block",
        "&:hover": { transform: "translateY(-2px)", transition: "0.2s ease" },
      }}
    >
      <Typography
        fontFamily="Poppins, sans-serif"
        fontWeight={600}
        fontSize={nameFontSize}
        sx={{ position: "absolute", top: nameTop, left: nameLeft }}
      >
        {hive.name}
      </Typography>

      <Box sx={{ position: "absolute", top: avatarTop, left: avatarLeft, width: avatarSize, height: avatarSize }}>
        <HiveAvatar hive={hive} onEditClick={onEditClick} />
      </Box>

      <Stack spacing={0.5} sx={{ position: "absolute", top: infoTop, left: infoLeft }}>
        <Typography fontFamily="Inter, sans-serif" fontWeight={500} fontSize={infoFontSize}>
          current temp: {hive.currentTemp}
        </Typography>
        <Typography fontFamily="Inter, sans-serif" fontWeight={500} fontSize={infoFontSize}>
          hive status: {hive.status}
        </Typography>
        <Typography fontFamily="Inter, sans-serif" fontWeight={500} fontSize={infoFontSize}>
          system online: {hive.systemOnline ? "y" : "n"}
        </Typography>
      </Stack>
    </Paper>
  );
}

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "temp", label: "Temperature" },
  { value: "date", label: "Date Activated" },
];

const STATUS_OPTIONS = ["active", "inactive", "maintenance"];

export default function HiveOverviewUI({
  userName,
  stats,
  hives,
  appTitle,
  onDatabaseClick,
  onSettingsClick,
  onHiveUpdated,
}) {
  const [editingHive, setEditingHive] = useState(null);
  const [sortAnchor, setSortAnchor] = useState(null);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [filterAlerts, setFilterAlerts] = useState(false);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterOnline, setFilterOnline] = useState(false);

  function toggleStatus(status) {
    setFilterStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  const activeFilterCount =
    (filterAlerts ? 1 : 0) + filterStatuses.length + (filterOnline ? 1 : 0);

  const displayedHives = useMemo(() => {
    let result = [...hives];

    if (filterAlerts) result = result.filter((h) => h.hasActiveAlerts);
    if (filterStatuses.length > 0)
      result = result.filter((h) => filterStatuses.includes(h.status?.toLowerCase()));
    if (filterOnline) result = result.filter((h) => h.systemOnline);

    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "temp") {
        const aVal = a.tempValue ?? -Infinity;
        const bVal = b.tempValue ?? -Infinity;
        return bVal - aVal;
      }
      if (sortBy === "date") {
        const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return aDate - bDate;
      }
      return 0;
    });

    return result;
  }, [hives, sortBy, filterAlerts, filterStatuses, filterOnline]);

  const btnSx = {
    color: "black",
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    fontSize: { xs: 15, sm: 18, md: 24 },
    textTransform: "none",
    minWidth: 0,
    px: { xs: 0.5, md: 1 },
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#fff9e9",
        backgroundImage: { xs: "none", sm: "none", md: `url(${overviewBg})` },
        backgroundSize: { md: "cover" },
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >
      <NavBar
        appTitle={appTitle}
        onDatabaseClick={onDatabaseClick}
        onSettingsClick={onSettingsClick}
      />

      <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: { xs: 2, sm: 3, md: 4 } }}>
        <Typography
          fontFamily="Poppins, sans-serif"
          fontWeight={500}
          fontSize={{ xs: 32, sm: 44, md: 60 }}
          textAlign="center"
          mb={{ xs: 2, sm: 3, md: 4 }}
        >
          hello {userName}
        </Typography>

        <Stack
          direction="row"
          useFlexGap
          spacing={{ xs: 1, sm: 2, md: 3 }}
          justifyContent="center"
          flexWrap="wrap"
          rowGap={{ xs: 1.5, sm: 2, md: 2.5 }}
          mb={{ xs: 3, sm: 4, md: 5 }}
        >
          <StatCard label="Total Hives" value={stats.totalHives} />
          <StatCard label="Active Alerts" value={stats.activeAlerts} />
          <StatCard label="Systems Online" value={stats.systemsOnline} />
          <StatCard label="Avg Temp Across Hives" value={stats.avgTemp} />
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          mb={{ xs: 2, sm: 2.5, md: 3 }}
          spacing={2}
        >
          <Typography
            fontFamily="Poppins, sans-serif"
            fontWeight={700}
            fontSize={{ xs: 20, sm: 26, md: 32 }}
          >
            your hives:
          </Typography>

          <Stack direction="row" spacing={1} sx={{ ml: { xs: 1, md: 4 } }}>
            {/* Sort */}
            <Button
              variant="text"
              sx={btnSx}
              onClick={(e) => setSortAnchor(e.currentTarget)}
            >
              Sort
            </Button>
            <Menu
              anchorEl={sortAnchor}
              open={Boolean(sortAnchor)}
              onClose={() => setSortAnchor(null)}
            >
              <FormControl sx={{ px: 2, py: 1 }}>
                <RadioGroup
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setSortAnchor(null); }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <FormControlLabel
                      key={opt.value}
                      value={opt.value}
                      control={<Radio size="small" />}
                      label={opt.label}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </Menu>

            {/* Filters */}
            <Button
              variant="text"
              endIcon={<ArrowRightIcon />}
              sx={btnSx}
              onClick={(e) => setFilterAnchor(e.currentTarget)}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            <Menu
              anchorEl={filterAnchor}
              open={Boolean(filterAnchor)}
              onClose={() => setFilterAnchor(null)}
            >
              <MenuItem disableRipple>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filterAlerts}
                      onChange={(e) => setFilterAlerts(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Active Alerts"
                />
              </MenuItem>
              <MenuItem disableRipple>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={filterOnline}
                      onChange={(e) => setFilterOnline(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Online Systems Only"
                />
              </MenuItem>
              <Divider />
              <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: 12, color: "text.secondary" }}>
                Hive Status
              </Typography>
              {STATUS_OPTIONS.map((status) => (
                <MenuItem key={status} disableRipple>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filterStatuses.includes(status)}
                        onChange={() => toggleStatus(status)}
                        size="small"
                      />
                    }
                    label={status.charAt(0).toUpperCase() + status.slice(1)}
                  />
                </MenuItem>
              ))}
              {activeFilterCount > 0 && (
                <>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      setFilterAlerts(false);
                      setFilterStatuses([]);
                      setFilterOnline(false);
                    }}
                  >
                    <ListItemText
                      primary="Clear all filters"
                      primaryTypographyProps={{ fontSize: 13, color: "error.main" }}
                    />
                  </MenuItem>
                </>
              )}
            </Menu>
          </Stack>
        </Stack>

        {displayedHives.length === 0 ? (
          <Typography fontFamily="Inter, sans-serif" color="text.secondary" textAlign="center">
            No hives match the current filters.
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr"
                : isTablet
                ? "repeat(2, 220px)"
                : "repeat(auto-fit, 283px)",
              gap: { xs: 2, sm: 2.5, md: 3 },
              justifyContent: "center",
              maxWidth: isMobile ? 420 : "100%",
              mx: isMobile ? "auto" : 0,
            }}
          >
            {displayedHives.map((hive) => (
              <HiveCard
                key={hive.hive_id ?? hive.name}
                hive={hive}
                onEditClick={() => setEditingHive(hive)}
              />
            ))}
          </Box>
        )}
      </Box>

      <HiveEditDialog
        hive={editingHive}
        open={Boolean(editingHive)}
        onClose={() => setEditingHive(null)}
        onSaved={() => { setEditingHive(null); onHiveUpdated?.(); }}
      />

      <Box sx={{ pt: 6 }}>
        <Footer />
      </Box>
    </Box>
  );
}
