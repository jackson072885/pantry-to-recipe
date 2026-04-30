import { NavLink, Route, Routes } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/Home";
import PantryPage from "./pages/Pantry";
import RecipeBrowserPage from "./pages/RecipeBrowser";
import RecommendationsPage from "./pages/Search";
import RecipeDetailPage from "./pages/RecipeDetail";

function App() {
  return (
    <div className="app-shell">
      <nav className="top-nav">
        <NavLink to="/" end>
          Dinner Tonight
        </NavLink>
        <NavLink to="/pantry">Your Pantry</NavLink>
        <NavLink to="/recommendations">Tonight’s Matches</NavLink>
        <NavLink to="/recipe-browser">Recipe Browser</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/recipe-browser" element={<RecipeBrowserPage />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
      </Routes>
    </div>
  );
}

export default App;
