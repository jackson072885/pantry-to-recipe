import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/Home";
import PantryPage from "./pages/Pantry";
import WelcomePage from "./pages/Welcome";
import SearchPage from "./pages/Search";

function App() {
  return (
    <div className="app-shell">
      <nav className="top-nav">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/pantry">Pantry</NavLink>
        <NavLink to="/search">Search</NavLink>
        <NavLink to="/welcome">Welcome</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
      </Routes>
    </div>
  );
}

export default App;
