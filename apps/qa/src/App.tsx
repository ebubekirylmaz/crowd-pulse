import { BrowserRouter } from "react-router-dom";
import QaRoutes from "./Routes.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <QaRoutes />
    </BrowserRouter>
  );
}
