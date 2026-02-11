import {
  AppBar,
  Toolbar,
  Button,
  Stack,
  Box,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import DubaiLogo from "../assets/Logo.png";

export default function WebsiteNav() {
  const { pathname } = useLocation();

  const isYourHive = [
    "/",
    "/humidity",
    "/weight",
    "/carbon",
    "/volume",
  ].includes(pathname);

  const prevent = (e) => e.preventDefault();

  return (
    <AppBar position="static" sx={{ width: "100%" }}>
      <Toolbar
        sx={{
          width: "100%",
          maxWidth: "none",
          px: 3,
        }}
      >
        {/* Logo + Title */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            component="img"
            src={DubaiLogo}
            alt="Dubai Team Logo"
            sx={{
              height: 72, 
              width: "auto",
            }}
          />

          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Beehive Dashboard
          </Typography>
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        {/* Nav Links */}
        <Stack direction="row" spacing={3} alignItems="center">
          <Button
            component={RouterLink}
            to="/"
            sx={{
              textTransform: "none",
              fontWeight: isYourHive ? 700 : 400,
              color: isYourHive ? "#FFFFFF" : "inherit",
            }}
          >
            Your Hive
          </Button>

          <Button
            href="#"
            onClick={prevent}
            sx={{ textTransform: "none" }}
          >
            Alerts
          </Button>

          <Button
            href="#"
            onClick={prevent}
            sx={{ textTransform: "none" }}
          >
            System
          </Button>

          <Button
            href="#"
            onClick={prevent}
            sx={{ textTransform: "none", pr: 1 }}
          >
            Log Out
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
