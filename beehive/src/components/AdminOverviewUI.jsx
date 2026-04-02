import React from "react";
import { Link } from "react-router-dom";
import {
  AppBar,
  Box,
  InputBase,
  Paper,
  Stack,
  Toolbar,
  Typography,
  Button,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";

const HEX_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="190">
  <polygon points="110,4 210,58 210,166 110,186 10,132 10,58"
    fill="none" stroke="rgba(251,193,57,0.5)" stroke-width="2.5"/>
</svg>`;
const HEX_BG = `url("data:image/svg+xml,${encodeURIComponent(HEX_SVG)}")`;

function NavBar({
  appTitle = "DUBAI Hive Monitoring",
  onAlertsClick,
  onDatabaseClick,
  onSettingsClick,
}) {
  return (
    <AppBar position="static" elevation={4} sx={{ bgcolor: "#fbc139", color: "black" }}>
      <Toolbar sx={{ px: 3 }}>
        <Box sx={{ width: 60, height: 60, bgcolor: "white", flexShrink: 0, mr: 2 }} />
        <Typography
          fontFamily="Poppins, sans-serif"
          fontWeight={700}
          fontSize={22}
          color="white"
          sx={{ textDecoration: "underline", flexGrow: 1 }}
        >
          {appTitle}
        </Typography>
        <Stack direction="row" spacing={4}>
          {[
            { label: "Alerts", onClick: onAlertsClick },
            { label: "Database", onClick: onDatabaseClick },
            { label: "Settings", onClick: onSettingsClick },
          ].map(({ label, onClick }) => (
            <Typography
              key={label}
              component="span"
              fontFamily="Inter, sans-serif"
              fontWeight={500}
              fontSize={20}
              sx={{ cursor: "pointer", "&:hover": { opacity: 0.75 } }}
              onClick={onClick}
            >
              {label}
            </Typography>
          ))}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

function StatCard({ label, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 4,
        py: 3,
        bgcolor: "#fff9e9",
        border: "2px solid black",
        borderRadius: "11px",
        whiteSpace: "nowrap",
      }}
    >
      <Typography fontFamily="Inter, sans-serif" fontWeight={600} fontSize={16} textAlign="center">
        {label}: {value}
      </Typography>
    </Paper>
  );
}

function HiveCard({ hive }) {
  return (
    <Paper
      component={Link}
      to={`/hives/${hive.hive_id}`}
      variant="outlined"
      sx={{
        width: 283,
        height: 191,
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
        "&:hover": {
          transform: "translateY(-2px)",
          transition: "0.2s ease",
        },
      }}
    >
      <Typography
        fontFamily="Poppins, sans-serif"
        fontWeight={600}
        fontSize={20}
        sx={{ position: "absolute", top: 18, left: 19 }}
      >
        {hive.name}
      </Typography>
      <Box
        sx={{
          position: "absolute",
          top: 58,
          left: 21,
          width: 108,
          height: 108,
          bgcolor: "white",
          border: "2px solid black",
          borderRadius: "11px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hive.icon ?? null}
      </Box>
      <Stack spacing={0.5} sx={{ position: "absolute", top: 64, left: 144 }}>
        <Typography fontFamily="Inter, sans-serif" fontWeight={500} fontSize={12}>
          current temp: {hive.currentTemp}
        </Typography>
        <Typography fontFamily="Inter, sans-serif" fontWeight={500} fontSize={12}>
          hive status: {hive.status}
        </Typography>
        <Typography fontFamily="Inter, sans-serif" fontWeight={500} fontSize={12}>
          system online: {hive.systemOnline ? "y" : "n"}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function AdminOverviewUI({
  stats,
  hives,
  activeTab = "hives",
  searchValue = "",
  appTitle,
  onTabChange,
  onSearchChange,
  onFilterClick,
  onAlertsClick,
  onDatabaseClick,
  onSettingsClick,
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#fff9e9",
        backgroundImage: HEX_BG,
        backgroundSize: "220px 190px",
        overflow: "hidden",
      }}
    >
      <NavBar
        appTitle={appTitle}
        onAlertsClick={onAlertsClick}
        onDatabaseClick={onDatabaseClick}
        onSettingsClick={onSettingsClick}
      />

      <Box sx={{ px: 6, py: 4 }}>
        <Typography
          fontFamily="Poppins, sans-serif"
          fontWeight={500}
          fontSize={60}
          textAlign="center"
          mb={4}
        >
          admin page
        </Typography>

        <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap" mb={4}>
          <StatCard label="Total Hives" value={stats.totalHives} />
          <StatCard label="Active Alerts" value={stats.activeAlerts} />
          <StatCard label="Systems Offline" value={stats.systemsOffline} />
          <StatCard label="Systems Online" value={stats.systemsOnline} />
        </Stack>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mx: "auto",
            maxWidth: 866,
            height: 50,
            bgcolor: "white",
            border: "2px solid black",
            borderRadius: "6px",
            px: 2,
            gap: 1,
            mb: 3,
          }}
        >
          <SearchIcon sx={{ color: "#d9d9d9", flexShrink: 0 }} />
          <InputBase
            fullWidth
            placeholder="Search for Users or Hives"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            inputProps={{ "aria-label": "search" }}
            sx={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: 16,
              color: "black",
              "& ::placeholder": { color: "black", opacity: 1 },
            }}
          />
        </Box>

        <Stack direction="row" alignItems="center" justifyContent="center" spacing={2} mb={3}>
          {["hives", "users"].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Typography
                key={tab}
                component="span"
                fontFamily="Poppins, sans-serif"
                fontWeight={700}
                fontSize={32}
                color={isActive ? "black" : "rgba(0,0,0,0.5)"}
                sx={{
                  textDecoration: isActive ? "underline" : "none",
                  cursor: "pointer",
                  userSelect: "none",
                  px: 1,
                  "&:hover": { opacity: 0.8 },
                }}
                onClick={() => onTabChange?.(tab)}
              >
                {tab}
              </Typography>
            );
          })}

          <Button
            variant="text"
            endIcon={<ArrowRightIcon />}
            onClick={onFilterClick}
            sx={{
              ml: 4,
              color: "black",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              fontSize: 24,
              textTransform: "none",
            }}
          >
            Filters
          </Button>
        </Stack>

        <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap">
          {hives.map((hive, i) => (
            <HiveCard key={hive.hive_id ?? hive.name ?? i} hive={hive} />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}