import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";

import SensorAveragesCard from "./SensorAveragesCard";
import SensorLineChartControlled from "./sensorLineChart";

export default function SensorDashboardRow({
  selectedSensorId,
  sensorOptions = [],
  onSelectedSensorIdChange,
  sensorIds,
  showLocalWeather = false,
}) {
  const WINDOW_DAYS = 14;

  const defaultEnd = useMemo(() => dayjs(), []);
  const defaultStart = useMemo(() => dayjs().subtract(WINDOW_DAYS, "day"), []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const [activeSensorId, setActiveSensorId] = useState(
    selectedSensorId ?? sensorOptions?.[0]?.id ?? null
  );

  useEffect(() => {
    if (selectedSensorId != null) setActiveSensorId(selectedSensorId);
  }, [selectedSensorId]);

  const handleSensorChange = (nextId) => {
    setActiveSensorId(nextId);
    if (typeof onSelectedSensorIdChange === "function") onSelectedSensorIdChange(nextId);
  };

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
      <Box sx={{ width: { md: "25%" }, flexShrink: 0, minWidth: 260 }}>
        <SensorAveragesCard sensorIds={sensorIds} startDate={startDate} endDate={endDate} />
      </Box>

      <Box sx={{ width: { md: "75%" }, minWidth: 420 }}>
        <SensorLineChartControlled
          sensorId={activeSensorId}
          sensorOptions={sensorOptions}
          onSensorChange={handleSensorChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          showLocalWeather={showLocalWeather}
        />
      </Box>
    </Stack>
  );
}
