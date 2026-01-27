import React, { useEffect, useState } from "react";
import { supabase } from "./createClient";
import SensorLineChart from "./components/sensorLineChart";


const App1 = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("first_name, email");

      if (error) {
        console.error("Error fetching users:", error);
      } else {
        setUsers(data);
      }
    };

    fetchUsers();
  }, []);

  function App() {
  return (
    <div style={{ padding: "24px" }}>
      <h1>Beehive Monitoring Dashboard</h1>

      {/* IMPORTANT: sensorId must exist in DB */}
      <SensorLineChart sensorId={41} />
    </div>
  );
}

};

export default App1;
