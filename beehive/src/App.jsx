import React, { useEffect, useState } from "react";
import { supabase } from "./createClient";
import SensorLineChart from "./components/sensorLineChart";


  function App() {
  return (
    <div style={{ padding: "24px" }}>
      <h1>Beehive Monitoring Dashboard</h1>

      {/* IMPORTANT: sensorId must exist in DB */}
      <SensorLineChart sensorId={41} />
    </div>
  );
}


export default App;
