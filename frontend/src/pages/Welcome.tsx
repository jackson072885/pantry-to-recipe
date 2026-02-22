import { Link } from "react-router-dom";

function WelcomePage() {
  return (
    <div style={{ padding: "2.5rem 1.5rem", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.75rem" }}>Welcome to Pantry-to-Recipe</h1>
      <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem" }}>
        Cook incredible meals with what you already have.
      </p>
      <Link
        to="/pantry"
        style={{
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          background: "#1d4ed8",
          color: "#fff",
          borderRadius: 6,
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Start by adding pantry items
      </Link>
    </div>
  );
}

export default WelcomePage;
