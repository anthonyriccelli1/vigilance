import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import FacilityMap from "./pages/FacilityMap";
import Assets from "./pages/Assets";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<FacilityMap />} />
          <Route path="assets" element={<Assets />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
