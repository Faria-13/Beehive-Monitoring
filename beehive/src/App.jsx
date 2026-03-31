import React from "react";
import { Routes, Route } from "react-router-dom";
import Temperature from "./pages/Temperature";
import Humidity from "./pages/Humidity";
import Weight from "./pages/Weight";
import WebsiteNav from "./components/topNav";
import Carbon from "./pages/Carbon";
import Volume from "./pages/Volume";
import AlertsPage from "./pages/AlertsPage";

function App() {
  return (
    <>
      <WebsiteNav />

      <div style={{ padding: "24px" }}>
        <Routes>
          <Route path="/"         element={<Temperature />} />
          <Route path="/humidity" element={<Humidity />} />
          <Route path="/weight"   element={<Weight />} />
          <Route path="/carbon"   element={<Carbon />} />
          <Route path="/volume"   element={<Volume />} />
          <Route path="/alerts"   element={<AlertsPage />} />
        </Routes>
      </div>
    </>
  );
}

export default App;