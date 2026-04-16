import React, { useState } from "react";
import { Link } from "react-router-dom";
import AdminNavBar from "./AdminNavBar";
import {
  Box,
  InputBase,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

// ─── Stat card ────────────────────────────────────────────────────────────────

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

// ─── Hive card ────────────────────────────────────────────────────────────────

function HiveCard({ hive, isMobile, isTablet }) {
  const cardW = isMobile ? "100%" : isTablet ? 220 : 283;
  const cardH = isMobile ? 160 : isTablet ? 148 : 191;
  const cardMaxW = isMobile ? 420 : undefined;

  const nameTop   = isMobile ? 12 : isTablet ? 14 : 18;
  const nameLeft  = isMobile ? 14 : isTablet ? 15 : 19;
  const nameFontSize = isTablet || isMobile ? 16 : 20;

  const infoTop  = isMobile ? 52 : isTablet ? 50 : 64;
  const infoLeft = isMobile ? 14 : isTablet ? 15 : 19;
  const infoFontSize = isTablet ? 11 : 12;

  return (
    <Paper
      component={Link}
      to={`/admin/hives/${hive.hive_id}`}
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

      <Stack spacing={0.5} sx={{ position: "absolute", top: infoTop, left: infoLeft }}>
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

// ─── User card ────────────────────────────────────────────────────────────────

function UserCard({ user, isMobile, isTablet }) {
  const cardW    = isMobile ? "100%" : isTablet ? 220 : 283;
  const cardMaxW = isMobile ? 420 : undefined;

  const nameFontSize  = isTablet ? 15 : 18;
  const emailFontSize = isTablet ? 10 : 11;
  const infoFontSize  = isTablet ? 12 : 13;

  return (
    <Paper
      variant="outlined"
      sx={{
        width: cardW,
        maxWidth: cardMaxW,
        bgcolor: "#fff9e9",
        border: "2px solid black",
        borderRadius: "11px",
        overflow: "hidden",
        boxShadow: "0px 4px 4px rgba(0,0,0,0.25)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        "&:hover": { transform: "translateY(-2px)", transition: "0.2s ease" },
      }}
    >
      {/* Coloured header strip */}
      <Box sx={{ bgcolor: "#fbc139", px: 2, py: 1.25, borderBottom: "2px solid black" }}>
        <Typography
          fontFamily="Poppins, sans-serif"
          fontWeight={700}
          fontSize={nameFontSize}
          noWrap
        >
          {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
        </Typography>
      </Box>

      {/* Body */}
      <Box
        sx={{
          px: 2,
          py: { xs: 1.5, sm: 2 },
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Typography
          fontFamily="Inter, sans-serif"
          fontSize={emailFontSize}
          color="text.secondary"
          noWrap
          mb={1.5}
        >
          {user.email ?? "—"}
        </Typography>

        <Stack spacing={0.75}>
          <Typography fontFamily="Inter, sans-serif" fontWeight={500} fontSize={infoFontSize}>
            🐝 Hives: {user.hiveCount ?? 0}
          </Typography>
          <Typography
            fontFamily="Inter, sans-serif"
            fontWeight={500}
            fontSize={infoFontSize}
            color={user.alertCount > 0 ? "#FF4D4D" : "inherit"}
          >
            ⚠ Active Alerts: {user.alertCount ?? 0}
          </Typography>
        </Stack>
      </Box>
    </Paper>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminOverviewUI({
  stats,
  hives,
  users = [],
  activeTab = "hives",
  searchValue = "",
  appTitle,
  onTabChange,
  onSearchChange,
  onFilterClick,
}) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  const items = activeTab === "users" ? users : hives;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff9e9" }}>
      <AdminNavBar appTitle={appTitle} />

      <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: { xs: 2, sm: 3, md: 4 } }}>

        {/* Title */}
        <Typography
          fontFamily="Poppins, sans-serif"
          fontWeight={500}
          fontSize={{ xs: 32, sm: 44, md: 60 }}
          textAlign="center"
          mb={{ xs: 2, sm: 3, md: 4 }}
        >
          admin page
        </Typography>

        {/* Stat cards */}
        <Stack
          useFlexGap
          direction="row"
          spacing={{ xs: 1, sm: 2, md: 3 }}
          rowGap={{ xs: 1.5, sm: 2, md: 2.5 }}
          justifyContent="center"
          flexWrap="wrap"
          mb={{ xs: 3, sm: 4, md: 4 }}
        >
          <StatCard label="Total Hives"     value={stats.totalHives}    />
          <StatCard label="Active Alerts"   value={stats.activeAlerts}  />
          <StatCard label="Systems Offline" value={stats.systemsOffline}/>
          <StatCard label="Systems Online"  value={stats.systemsOnline} />
        </Stack>

        {/* Search bar */}
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
            placeholder={activeTab === "users" ? "Search users…" : "Search hives…"}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            sx={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: { xs: 14, sm: 16 },
              color: "black",
              "& ::placeholder": { color: "black", opacity: 1 },
            }}
          />
        </Box>

        {/* Tab row */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={2}
          mb={{ xs: 2, sm: 2.5, md: 3 }}
        >
          {["hives", "users"].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Typography
                key={tab}
                component="span"
                fontFamily="Poppins, sans-serif"
                fontWeight={700}
                fontSize={{ xs: 20, sm: 26, md: 32 }}
                color={isActive ? "black" : "rgba(0,0,0,0.4)"}
                sx={{
                  textDecoration: isActive ? "underline" : "none",
                  textUnderlineOffset: "5px",
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

        </Stack>

        {/* Card grid */}
        {items.length === 0 ? (
          <Typography fontFamily="Inter, sans-serif" color="text.secondary" textAlign="center">
            No {activeTab} found.
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
            {activeTab === "users"
              ? users.map((u, i) => (
                  <UserCard
                    key={u.user_id ?? i}
                    user={u}
                    isMobile={isMobile}
                    isTablet={isTablet}
                  />
                ))
              : hives.map((hive, i) => (
                  <HiveCard
                    key={hive.hive_id ?? i}
                    hive={hive}
                    isMobile={isMobile}
                    isTablet={isTablet}
                  />
                ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
