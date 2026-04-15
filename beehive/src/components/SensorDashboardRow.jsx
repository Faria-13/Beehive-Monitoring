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

  const defaultEnd   = useMemo(() => dayjs(), []);
  const defaultStart = useMemo(() => dayjs().subtract(WINDOW_DAYS, "day"), []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate,   setEndDate]   = useState(defaultEnd);

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

  // ── shared 14-day window handlers (used by both the chart and the averages card) ──
  const resetToDefaultWindow = () => {
    const end   = dayjs();
    const start = end.subtract(WINDOW_DAYS, "day");
    setStartDate(start);
    setEndDate(end);
  };

  const handleStartChange = (v) => {
    if (!v || !v.isValid()) return;
    const proposedEnd = v.add(WINDOW_DAYS, "day");
    if (proposedEnd.isAfter(dayjs(), "day")) {
      resetToDefaultWindow();
      return;
    }
    setStartDate(v);
    setEndDate(proposedEnd);
  };

  const handleEndChange = (v) => {
    if (!v || !v.isValid()) return;
    const today  = dayjs();
    const safeEnd = v.isAfter(today, "day") ? today : v;
    setEndDate(safeEnd);
    setStartDate(safeEnd.subtract(WINDOW_DAYS, "day"));
  };

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
      <Box sx={{ width: { md: "25%" }, flexShrink: 0, minWidth: 260 }}>
        <SensorAveragesCard
          sensorIds={sensorIds}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleStartChange}
          onEndDateChange={handleEndChange}
        />
      </Box>

      <Box sx={{ width: { md: "75%" }, minWidth: 420 }}>
        <SensorLineChartControlled
          sensorId={activeSensorId}
          sensorOptions={sensorOptions}
          onSensorChange={handleSensorChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleStartChange}
          onEndDateChange={handleEndChange}
          showLocalWeather={showLocalWeather && activeSensorId === selectedSensorId}
        />
      </Box>
    </Stack>
  );
}
