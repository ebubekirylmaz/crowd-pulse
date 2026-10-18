import { BrowserRouter, Route, Routes } from "react-router-dom";

import Join from "./pages/Join.tsx";
import Room from "./pages/Room.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/join/:code" element={<Join />} />
        <Route path="/r/:code" element={<Room />} />
        <Route path="*" element={<div>Bilgi</div>} />
      </Routes>
    </BrowserRouter>
  );
}
