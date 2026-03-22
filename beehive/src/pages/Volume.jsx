import Box from "@mui/material/Box";
import SensorDashboardRow from "../components/SensorDashboardRow";

export default function Volume() {
  const sensorOptions = [
    { id: 4, label: "Temperature" },
    { id: 3, label: "Humidity" },
    { id: 44, label: "Weight" },
    { id: 1, label: "Carbon" },
    { id: 80, label: "Volume" },
  ];

  const sensorIds = sensorOptions.map((s) => s.id);

  return (
    <Box sx={{ px: 2, py: 2, maxWidth: 1400, mx: "auto" }}>
      <SensorDashboardRow
      key="volume"
        selectedSensorId={80}
        sensorIds={sensorIds}
        sensorOptions={sensorOptions}
        showLocalWeather={false}
      />
    </Box>
  );
}
