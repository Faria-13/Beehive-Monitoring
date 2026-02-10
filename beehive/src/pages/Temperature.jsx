import Box from "@mui/material/Box";
import SensorDashboardRow from "../components/SensorDashboardRow";

export default function Temperature() {
  const sensorIds = [41, 42, 44, 68, 80];

  return (
    <Box sx={{ px: 2, py: 2, maxWidth: 1400, mx: "auto" }}>
      <SensorDashboardRow
        selectedSensorId={41}
        sensorIds={sensorIds}
        showLocalWeather={true}
      />
    </Box>
  );
}
