import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import FacilityMap from "./pages/FacilityMap";
import Assets from "./pages/Assets";
import { FacilityMapProvider } from "./facilityMapStore";

export default function App() {
  return (
    // FacilityMapProvider sits ABOVE the router so it never unmounts.
    // Images and zone polygons survive navigation to other pages.
    <FacilityMapProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="map" element={<FacilityMap />} />
            <Route path="assets" element={<Assets />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FacilityMapProvider>
  );
}
