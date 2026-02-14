from __future__ import annotations

from typing import List

from fastapi import FastAPI, Depends
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.match_service import match_from_db
from app.routes.catalog import router as catalog_router


app = FastAPI(title="Pantry-to-Recipe API", version="0.2.0")

app.include_router(catalog_router)


class MatchRequest(BaseModel):
    pantry: List[str] = Field(default_factory=list, description="List of pantry items.")


@app.get("/", response_class=HTMLResponse)
def root():
    return """
<!DOCTYPE html>
<html>
<head>
  <title>Pantry-to-Recipe</title>
</head>
<body style="font-family: Arial; margin: 40px;">
  <h1>On-Hand Cookbook (Backend)</h1>
  <p>Enter pantry items (comma separated):</p>

  <input id="pantry" style="width: 100%; padding: 10px;" placeholder="eggs, cheddar, butter" />
  <button style="margin-top: 10px; padding: 10px 16px;" onclick="runMatch()">Find Recipes</button>

  <pre id="output" style="margin-top: 20px; padding: 16px; background: #111827; color: #e5e7eb;">Results will appear here...</pre>

  <p style="margin-top: 18px;">
    Try the ingredient search endpoint: <code>/catalog/ingredients/search?q=cheddar</code>
  </p>

  <script>
    async function runMatch() {
      const pantryInput = document.getElementById("pantry").value;
      const pantry = pantryInput.split(",").map(x => x.trim()).filter(Boolean);

      const res = await fetch("/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantry })
      });

      const data = await res.json();
      document.getElementById("output").textContent = JSON.stringify(data, null, 2);
    }
  </script>
</body>
</html>
"""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/match")
def match(req: MatchRequest, db: Session = Depends(get_db)):
    return match_from_db(db, req.pantry)
