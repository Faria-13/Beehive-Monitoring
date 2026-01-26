import { useEffect, useState } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import { fetchSensorReadings } from "../api/sensorReadings";

export default function SensorLineChart({ sensorId }) {
  const [readings, setReadings] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const data = await fetchSensorReadings(sensorId, 50);
        if (!cancelled) setReadings(data);
      } catch (e) {
        if (!cancelled) setError(e.message ?? "Failed to load readings");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sensorId]);

  if (error) return <div style={{ padding: 12 }}>Error: {error}</div>;
  if (readings.length === 0) return <div style={{ padding: 12 }}>Loading…</div>;

  const xData = readings.map((r) => new Date(r.timestamp));
  const yData = readings.map((r) => Number(r.value));

  return (
    <LineChart
      xAxis={[{ data: xData, scaleType: "time" }]}
      series={[{ data: yData, label: `Sensor ${sensorId}` }]}
      height={300}
    />
  );
}
