from __future__ import annotations

from app.db import SessionLocal
from app.services.recipe_curation_service import apply_recipe_curation, audit_recipe_catalog


def test_recipe_curation_audit_reports_bucket_counts(client) -> None:  # noqa: ARG001
    db = SessionLocal()
    try:
        report = audit_recipe_catalog(db)
        assert report["total_active"] >= 30
        assert "KEEP_AS_IS" in report["bucket_counts"]
        assert isinstance(report["recipes"], list)
        assert report["recipes"]
    finally:
        db.close()


def test_recipe_curation_apply_summary_matches_runtime_shape(client) -> None:  # noqa: ARG001
    db = SessionLocal()
    try:
        summary = apply_recipe_curation(db)
        assert summary["updated"] >= 30
        assert summary["production_ready"] >= 30
        assert "KEEP_AS_IS" in summary["bucket_counts"]
    finally:
        db.close()


def test_recipe_curation_audit_uses_real_score_breakdown(client) -> None:  # noqa: ARG001
    db = SessionLocal()
    try:
        report = audit_recipe_catalog(db)
        sample = next(
            row for row in report["recipes"] if row["bucket"] in {"KEEP_AS_IS", "KEEP_AND_ENRICH"}
        )
        component_keys = {
            "title_quality",
            "ingredient_completeness",
            "step_quality",
            "trust_and_cookability",
            "product_value",
            "data_hygiene",
        }
        assert component_keys.issubset(sample.keys())
        assert sample["total_score"] == sum(sample[key] for key in component_keys)
        assert all(0 <= sample[key] <= 5 for key in component_keys)
    finally:
        db.close()


def test_recipe_curation_audit_reports_triage_summary(client) -> None:  # noqa: ARG001
    db = SessionLocal()
    try:
        report = audit_recipe_catalog(db)
        assert "triage_counts" in report
        assert any(bucket in report["triage_counts"] for bucket in {"keep", "repair", "rewrite", "remove"})
        sample = next(row for row in report["recipes"] if row["triage"] in {"keep", "repair", "rewrite", "remove"})
        assert isinstance(sample["triage_issues"], list)
        assert sample["triage_issue_count"] == len(sample["triage_issues"])
    finally:
        db.close()


def test_recipe_curation_repair_wave_promotes_selected_dinners_to_keep(client) -> None:  # noqa: ARG001
    repaired_targets = {
        16: "Cheesy Baked Ziti",
        17: "Cheesy Beef Taco Skillet",
        18: "Garlic Alfredo Chicken Pasta",
        31: "Creamy Chicken Pot Pie Skillet",
        34: "Chicken Taco Rice Skillet",
        45: "Creamy Tomato Beef Pasta",
        54: "Ground Beef Quesadillas",
        66: "Mexican Bean and Corn Rice Skillet",
        68: "One Pot Sausage Marinara Pasta",
        70: "Pesto Chicken Pasta",
        78: "Skillet Chicken Ginger Rice",
        79: "Skillet Chicken Parmesan Pasta",
        80: "Skillet Lasagna Pasta",
        207: "Salsa Roja Beef Rice Skillet",
        229: "Cheesy Beef Enchilada Rice Skillet",
        145: "Soy Ginger Shrimp Lo Mein",
        258: "Creole Chicken Rice Skillet",
        412: "Beef Mushroom Skillet",
    }

    db = SessionLocal()
    try:
        report = audit_recipe_catalog(db)
        recipes_by_id = {row["recipe_id"]: row for row in report["recipes"]}

        for recipe_id, recipe_name in repaired_targets.items():
            row = recipes_by_id[recipe_id]
            assert row["recipe_name"] == recipe_name
            assert row["triage"] == "keep"
            assert row["triage_issues"] == []
    finally:
        db.close()
