import Box from "@mui/material/Box";
import SensorDashboardRow from "../components/SensorDashboardRow";

export default function Humidity() {
  const sensorOptions = [
    { id: 41, label: "Temperature" },
    { id: 42, label: "Humidity" },
    { id: 44, label: "Weight" },
    { id: 68, label: "Carbon" },
    { id: 80, label: "Volume" },
  ];

  const sensorIds = sensorOptions.map((s) => s.id);

  return (
    <Box sx={{ px: 2, py: 2, maxWidth: 1400, mx: "auto" }}>
      <SensorDashboardRow
        selectedSensorId={42}
        sensorIds={sensorIds}
        sensorOptions={sensorOptions}
      />
    </Box>
  );
}
