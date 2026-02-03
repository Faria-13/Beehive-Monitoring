import React from "react";
import SensorLineChart from "../components/SensorLineChart";

export default function Temperature() {
  // sensorId 41 = hive temperature
  return <SensorLineChart sensorId={41} showLocalWeather={true} />;
}
