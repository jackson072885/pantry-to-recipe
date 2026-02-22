import { NavLink, Route, Routes } from "react-router-dom";
import HomePage from "./pages/Home";
import PantryPage from "./pages/Pantry";
import WelcomePage from "./pages/Welcome";

function App() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <nav
        style={{
          display: "flex",
          gap: "1rem",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid #ddd",
        }}
      >
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/pantry">Pantry</NavLink>
        <NavLink to="/welcome">Welcome</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
      </Routes>
    </div>
  );
}

export default App;
