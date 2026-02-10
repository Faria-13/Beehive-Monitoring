import dayjs from "dayjs";
import { useMemo, useState } from "react";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";

import SensorAveragesCard from "./SensorAveragesCard";
import SensorLineChartControlled from "./SensorLineChart";

export default function SensorDashboardRow({
  selectedSensorId,
  sensorIds,
  showLocalWeather = false,
}) {
  const WINDOW_DAYS = 14;

  const defaultEnd = useMemo(() => dayjs(), []);
  const defaultStart = useMemo(() => dayjs().subtract(WINDOW_DAYS, "day"), []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      alignItems="stretch"
    >
      <Box sx={{ width: { md: "25%" }, flexShrink: 0, minWidth: 260 }}>
        <SensorAveragesCard sensorIds={sensorIds} startDate={startDate} endDate={endDate} />
      </Box>

      <Box sx={{ width: { md: "75%" }, minWidth: 420 }}>
        <SensorLineChartControlled
          sensorId={selectedSensorId}
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
