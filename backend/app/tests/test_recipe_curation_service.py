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
        15: "Cheesy Baked Ziti",
        16: "Cheesy Beef Taco Skillet",
        17: "Garlic Alfredo Chicken Pasta",
        30: "Creamy Chicken Pot Pie Skillet",
        33: "Chicken Taco Rice Skillet",
        44: "Creamy Tomato Beef Pasta",
        53: "Ground Beef Quesadillas",
        65: "Mexican Bean and Corn Rice Skillet",
        67: "One Pot Sausage Marinara Pasta",
        69: "Pesto Chicken Pasta",
        77: "Skillet Chicken Ginger Rice",
        78: "Skillet Chicken Parmesan Pasta",
        79: "Skillet Lasagna Pasta",
        194: "Salsa Roja Beef Rice Skillet",
        212: "Cheesy Beef Enchilada Rice Skillet",
        133: "Soy Ginger Shrimp Lo Mein",
        241: "Creole Chicken Rice Skillet",
        383: "Beef Mushroom Skillet",
        92: "Weeknight Beef Ragu",
        93: "Tomato Chicken Curry",
        58: "Lentil Spinach Curry",
        59: "Lentil Tomato Stew",
        60: "Cheddar Broccoli Loaded Baked Potatoes",
        61: "Loaded Cheddar Chicken Potato Casserole",
        63: "Mediterranean Chickpea Skillet",
        66: "Minestrone Soup",
        72: "Sausage Bean Chili",
        81: "Soy Sesame Tofu Rice Bowl",
        89: "Golden Vegetable Curry",
        94: "Red Chicken Enchiladas",
        91: "Veggie Black Bean Quesadillas",
        96: "Creamy Chicken Enchilada Skillet",
        97: "Beef Enchilada Casserole",
        98: "Street Corn Chicken Burrito Bowls",
        101: "Creamy White Chicken Chili",
        106: "Smoky Red Beans and Rice",
        107: "Calabacitas Bean Skillet",
        108: "Spiced Lentil Rice Pilaf",
        112: "Garlic Butter Shrimp and Broccoli",
        113: "Lemon Butter Baked Tilapia Packets",
        114: "Cajun Salmon Sheet Pan",
        115: "Spicy Tuna Tomato Pasta",
        116: "Cheesy Tuna Melt Quesadillas",
        121: "Miso Ginger Cod Rice Bowls",
        122: "Honey Soy Shrimp Rice Bowls",
        124: "Crispy Tofu Sushi Bowls",
        127: "Korean-Inspired Beef Sesame Rice Bowls",
        128: "Korean-Inspired Chicken Cabbage Bowls",
        130: "Miso Salmon Bok Choy Bowls",
        131: "Ginger Sesame Tuna Rice Bowls",
        195: "Poblano Bean Enchiladas",
        132: "Garlic Sesame Chicken Noodle Bowls",
        134: "Miso Butter Salmon Noodles",
        135: "Chili Garlic Beef Noodles",
        137: "Sesame Peanut Chicken Noodles",
        138: "Sesame Edamame Udon Bowls",
        140: "Ginger Garlic Pork Noodles",
        141: "Soy Mushroom Cabbage Noodles",
        142: "Coconut Curry Chicken Noodles",
        145: "Teriyaki Salmon Noodle Bowls",
        146: "Chili Sesame Tofu Noodles",
        147: "Black Pepper Beef Broccoli Stir-Fry",
        148: "Garlic Sesame Shrimp Stir-Fry",
        150: "Teriyaki Tofu Broccoli Stir-Fry",
        152: "Sesame Green Bean Pork Stir-Fry",
        153: "Soy Ginger Mushroom Cabbage Stir-Fry",
        154: "Honey Soy Chicken Pepper Stir-Fry",
        155: "Miso Shrimp Vegetable Stir-Fry",
        185: "Chipotle Shrimp Tacos",
        191: "Salsa Verde Shrimp Rice Bowls",
        210: "Beef Fajita Rice Bowls",
        158: "Ginger Carrot Chicken Stir-Fry",
        160: "Sriracha Garlic Shrimp Cabbage Stir-Fry",
        161: "Salmon Edamame Fried Rice",
        165: "Beef Broccoli Fried Rice",
        126: "Scallion Beef Rice Bowls",
        168: "Pork Cabbage Fried Rice",
        171: "Miso Glazed Salmon with Rice",
        174: "Sesame Ginger Salmon Sheet Pan",
        176: "Miso Butter Shrimp Foil Packets",
        177: "Ginger Garlic White Fish Plates",
        178: "Sticky Soy Chicken Thigh Tray",
        179: "Japanese-Inspired Chicken Curry Rice",
        180: "Japanese-Inspired Beef Curry Bowls",
        197: "Lime Cabbage Shrimp Taco Bowls",
        198: "Chile Lime Tilapia Plates",
        199: "Roasted Corn Black Bean Bowls",
        200: "Tomato Braised Pork Tacos",
        228: "Creamy Poblano Chicken Bowls",
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
