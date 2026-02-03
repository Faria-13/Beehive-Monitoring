import { AppBar, Toolbar, Button, Typography, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export default function TopNav() {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Beehive Dashboard
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button color="inherit" component={RouterLink} to="/">
            Temperature
          </Button>
          <Button color="inherit" component={RouterLink} to="/humidity">
            Humidity
          </Button>
          <Button color="inherit" component={RouterLink} to="/weight">
            Weight
          </Button>
          <Button color="inherit" component={RouterLink} to="/co2">
            Co2
          </Button>
          <Button color="inherit" component={RouterLink} to="/volume">
            Volume
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
