import { BrowserRouter, Route, Routes } from "react-router-dom";

import HostDashboard from "./pages/HostDashboard.tsx";
import HostLogin from "./pages/HostLogin.tsx";
import Join from "./pages/Join.tsx";
import RequireHost from "./components/RequireHost.tsx";
import Room from "./pages/Room.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/join/:code" element={<Join />} />
        <Route path="/r/:code" element={<Room />} />
        <Route path="/host/login" element={<HostLogin />} />
        <Route
          path="/host"
          element={
            <RequireHost>
              <HostDashboard />
            </RequireHost>
          }
        />
        <Route path="*" element={<div>Bilgi</div>} />
      </Routes>
    </BrowserRouter>
  );
}
