import React, { useEffect, useState } from "react";
import { supabase } from "./createClient";
import Temperature from "./pages/Temperature";
import Humidity from "./pages/Humidity";
import Weight from "./pages/Weight";

  function App() {
  return (
    <>
      <TopNav />

      <div style={{ padding: "24px" }}>
        <Routes>
          <Route path="/" element={<Temperature />} />
          <Route path="/humidity" element={<Humidity />} />
          <Route path="/weight" element={<Weight />} />
        </Routes>
      </div>
    </>
  );
}


export default App;
