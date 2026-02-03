import React, { useEffect, useState } from "react";
import { supabase } from "./createClient";
import { Routes, Route } from "react-router-dom";
import Temperature from "./pages/Temperature";
import Humidity from "./pages/Humidity";
import Weight from "./pages/Weight";
import TopNav from "./components/topNav";
import Carbon from "./pages/Carbon";
import Volume from "./pages/Volume";

  function App() {
  return (
    <>
      <TopNav />

      <div style={{ padding: "24px" }}>
        <Routes>
          <Route path="/" element={<Temperature />} />
          <Route path="/humidity" element={<Humidity />} />
          <Route path="/weight" element={<Weight />} />
          <Route path="/carbon" element={<Carbon />} />
          <Route path="/volume" element={<Volume />} />
        </Routes>
      </div>
    </>
  );
}


export default App;
