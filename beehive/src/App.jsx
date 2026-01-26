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

  return (
    <div style={{ padding: "1rem" }}>
       <h2>Sensor 1</h2>
      <SensorLineChart sensorId={41} />


      <h1>Beehive Users</h1>

      {users.length === 0 ? (
        <p>No users found</p>
      ) : (
        <ul>
          {users.map((user, index) => (
            <li key={index}>
              <strong>{user.first_name}</strong> — {user.email}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default App1;
