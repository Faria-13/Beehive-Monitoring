import { AppBar, Toolbar, Button, Stack, Box } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import DubaiLogo from "../assets/Logo.png";

export default function WebsiteNav() {
  const prevent = (e) => e.preventDefault();

  return (
    <AppBar position="static">
      <Toolbar sx={{ pl: 3, pr: 3 }}>
        <Box
          component="img"
          src={DubaiLogo}
          alt="Dubai Team Logo"
          sx={{ height: 36, width: "auto" }}
        />

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={3} alignItems="center">
          <Button color="inherit" component={RouterLink} to="/">
            Your Hive
          </Button>
          <Button color="inherit" href="#" onClick={prevent}>
            Alerts
          </Button>
          <Button color="inherit" href="#" onClick={prevent}>
            System
          </Button>
          <Button color="inherit" href="#" onClick={prevent} sx={{ pr: 1 }}>
            Log Out
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
