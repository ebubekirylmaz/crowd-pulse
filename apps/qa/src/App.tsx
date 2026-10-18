import { BrowserRouter, Route, Routes } from "react-router-dom";

import Join from "./pages/Join.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/join/:code" element={<Join />} />
        <Route path="/r/:code" element={<div>Oda</div>} />
        <Route path="*" element={<div>Bilgi</div>} />
      </Routes>
    </BrowserRouter>
  );
}
