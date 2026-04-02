import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../createClient";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";

import SensorDashboardRow from "../components/SensorDashboardRow";

export default function HiveDashboard() {
  const { hiveId } = useParams();

  const [hive, setHive] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [selectedSensorId, setSelectedSensorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!hiveId) return;

    async function loadHiveDashboard() {
      try {
        setLoading(true);
        setError(null);

        const { data: hiveData, error: hiveError } = await supabase
          .from("beehives")
          .select("*")
          .eq("hive_id", hiveId)
          .single();

        if (hiveError) throw hiveError;
        setHive(hiveData);

        const { data: boards, error: boardsError } = await supabase
          .from("iot_boards")
          .select("board_id")
          .eq("hive_id", hiveId);

        if (boardsError) throw boardsError;

        const boardIds = (boards ?? []).map((board) => board.board_id);

        if (boardIds.length === 0) {
          setSensors([]);
          setSelectedSensorId(null);

          const safeSensors = sensorData ?? [];
          console.log("HiveDashboard hiveId:", hiveId);
          console.log("HiveDashboard hive:", hiveData);
          console.log("HiveDashboard boards:", boards);
          console.log("HiveDashboard boardIds:", boardIds);
          console.log("HiveDashboard safeSensors:", safeSensors);

          setSensors(safeSensors);
          setSelectedSensorId(safeSensors[0]?.sensor_id ?? null);
          return;
        }

        const { data: sensorData, error: sensorsError } = await supabase
          .from("sensors")
          .select("sensor_id, board_id, sensor_type, unit, status")
          .in("board_id", boardIds)
          .order("sensor_id", { ascending: true });

        if (sensorsError) throw sensorsError;

        const safeSensors = sensorData ?? [];
        setSensors(safeSensors);
        setSelectedSensorId(safeSensors[0]?.sensor_id ?? null);
      } catch (e) {
        setError(e.message || "Failed to load hive dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadHiveDashboard();
  }, [hiveId]);

  const sensorOptions = useMemo(() => {
    return sensors.map((sensor) => ({
      id: sensor.sensor_id,
      label: sensor.sensor_type || `Sensor ${sensor.sensor_id}`,
    }));
  }, [sensors]);

  const sensorIds = useMemo(() => {
    return sensors.map((sensor) => sensor.sensor_id);
  }, [sensors]);

  if (loading) {
    return <Box sx={{ p: 3 }}>Loading hive dashboard...</Box>;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  if (!hive) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Hive not found.</Typography>
      </Box>
    );
  }

  if (sensors.length === 0) {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto", mt: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h4">
            {hive.hive_code || `Hive ${hive.hive_id}`}
          </Typography>
          <Typography>No sensors found for this hive.</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", mt: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4">
          {hive.hive_code || `Hive ${hive.hive_id}`}
        </Typography>

        <SensorDashboardRow
          selectedSensorId={selectedSensorId}
          onSelectedSensorIdChange={setSelectedSensorId}
          sensorIds={sensorIds}
          sensorOptions={sensorOptions}
          showLocalWeather={true}
        />
      </Stack>
    </Box>
  );
}