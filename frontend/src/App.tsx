import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/Home";
import PantryPage from "./pages/Pantry";
import WelcomePage from "./pages/Welcome";
import SearchPage from "./pages/Search";
import RecipeDetailPage from "./pages/RecipeDetail";
import ProviderPage from "./pages/Provider";

function App() {
  return (
    <div className="app-shell">
      <nav className="top-nav">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/pantry">Pantry</NavLink>
        <NavLink to="/search">Search</NavLink>
        <NavLink to="/provider">Provider</NavLink>
        <NavLink to="/welcome">Welcome</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route path="/provider" element={<ProviderPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
      </Routes>
    </div>
  );
}

export default App;
