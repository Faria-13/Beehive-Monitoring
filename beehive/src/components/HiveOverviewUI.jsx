import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  AppBar,
  Box,
  Paper,
  Stack,
  Toolbar,
  Typography,
  Button,
} from "@mui/material";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";

function HiveAvatar({ hive }) {
  const [hovered, setHovered] = useState(false);

  const imageSrc = hive.avatarUrl || hive.fallbackIcon;
  const bgColor = hive.avatarBgColor ?? "#FE9805";
  
  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
      }}
    >
      <Box
        component="img"
        src={imageSrc}
        alt={`${hive.name} avatar`}
        sx={{
          width: "72%",
          height: "72%",
          objectFit: "contain",
        }}
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
            cursor: "pointer",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "black",
            }}
          >
            edit
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function NavBar({
  appTitle = "DUBAI Hive Monitoring",
  onAlertsClick,
  onDatabaseClick,
  onSettingsClick,
}) {
  return (
    <AppBar
      position="static"
      elevation={4}
      sx={{ bgcolor: "#fbc139", color: "black" }}
    >
      <Toolbar sx={{ px: 3 }}>
        <Box
          sx={{
            width: 60,
            height: 60,
            bgcolor: "white",
            flexShrink: 0,
            mr: 2,
          }}
        />

        <Typography
          variant="h6"
          fontFamily="Poppins, sans-serif"
          fontWeight={700}
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
      <Typography
        fontFamily="Inter, sans-serif"
        fontWeight={600}
        fontSize={16}
        textAlign="center"
      >
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
        }}
      >
        <HiveAvatar hive={hive} />
      </Box>

      <Stack
        spacing={0.5}
        sx={{ position: "absolute", top: 64, left: 144 }}
      >
        <Typography
          fontFamily="Inter, sans-serif"
          fontWeight={500}
          fontSize={12}
        >
          current temp: {hive.currentTemp}
        </Typography>
        <Typography
          fontFamily="Inter, sans-serif"
          fontWeight={500}
          fontSize={12}
        >
          hive status: {hive.status}
        </Typography>
        <Typography
          fontFamily="Inter, sans-serif"
          fontWeight={500}
          fontSize={12}
        >
          system online: {hive.systemOnline ? "y" : "n"}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function HiveOverviewUI({
  userName,
  stats,
  hives,
  appTitle,
  onSortClick,
  onFilterClick,
  onAlertsClick,
  onDatabaseClick,
  onSettingsClick,
}) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff9e9", overflow: "hidden" }}>
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
          hello {userName}
        </Typography>

        <Stack
          direction="row"
          spacing={3}
          justifyContent="center"
          flexWrap="wrap"
          mb={5}
        >
          <StatCard label="Total Hives" value={stats.totalHives} />
          <StatCard label="Active Alerts" value={stats.activeAlerts} />
          <StatCard label="Avg Temp Across Hives" value={stats.avgTemp} />
          <StatCard label="Systems Online" value={stats.systemsOnline} />
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          mb={3}
          spacing={2}
        >
          <Typography
            fontFamily="Poppins, sans-serif"
            fontWeight={700}
            fontSize={32}
          >
            your hives:
          </Typography>

          <Stack direction="row" spacing={1} sx={{ ml: 4 }}>
            <Button
              variant="text"
              sx={{
                color: "black",
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                fontSize: 24,
                textTransform: "none",
              }}
              onClick={onSortClick}
            >
              Sort
            </Button>

            <Button
              variant="text"
              endIcon={<ArrowRightIcon />}
              sx={{
                color: "black",
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                fontSize: 24,
                textTransform: "none",
              }}
              onClick={onFilterClick}
            >
              Filters
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap">
          {hives.map((hive) => (
            <HiveCard key={hive.hive_id ?? hive.name} hive={hive} />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}