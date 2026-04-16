import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../createClient";
import {
  AppBar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

export default function AdminNavBar({
  appTitle = "DUBAI Admin",
  centerTitle,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const useHamburgerNav = useMediaQuery(theme.breakpoints.down("md"));
  const [hamburgerAnchor, setHamburgerAnchor] = useState(null);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const navItems = [
    { label: "Alerts", onClick: () => navigate("/admin/alerts"), path: "/admin/alerts" },
    { label: "Database", onClick: () => navigate("/admin/database"), path: "/admin/database" },
    { label: "Requests", onClick: () => navigate("/admin/requests"), path: "/admin/requests" },
    { label: "Logout", onClick: handleLogout, path: "/login" },
  ];

  const isActive = (path) =>
    path &&
    (location.pathname === path ||
      (path !== "/login" && location.pathname.startsWith(`${path}/`)));

  return (
    <AppBar
      position="sticky"
      elevation={4}
      sx={{ top: 0, zIndex: 1100, bgcolor: "#fbc139", color: "black" }}
    >
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

        <Box sx={{ flexGrow: 1 }}>
          <Typography
            component={Link}
            to="/admin"
            fontFamily="Poppins, sans-serif"
            fontWeight={700}
            sx={{
              display: "inline-flex",
              width: "fit-content",
              fontSize: { xs: 14, sm: 16, md: 18 },
              color: isActive("/admin") ? "#fff" : "#000",
              textDecoration: isActive("/admin") ? "underline" : "none",
              textUnderlineOffset: "4px",
              "&:hover": { textDecoration: "underline", opacity: 0.9 },
            }}
          >
            {appTitle}
          </Typography>
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
                  onClick={() => {
                    setHamburgerAnchor(null);
                    onClick?.();
                  }}
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
