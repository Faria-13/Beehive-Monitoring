import React from "react";
import SensorLineChart from "../components/sensorLineChart";

export default function Temperature() {
  // sensorId 41 = hive temperature
  return <SensorLineChart sensorId={41} showLocalWeather={true} />;
}
