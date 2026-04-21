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
        93: "Weeknight Beef Ragu",
        94: "Tomato Chicken Curry",
        59: "Lentil Spinach Curry",
        60: "Lentil Tomato Stew",
        61: "Cheddar Broccoli Loaded Baked Potatoes",
        62: "Loaded Cheddar Chicken Potato Casserole",
        64: "Mediterranean Chickpea Skillet",
        67: "Minestrone Soup",
        73: "Sausage Bean Chili",
        82: "Soy Sesame Tofu Rice Bowl",
        90: "Golden Vegetable Curry",
        95: "Red Chicken Enchiladas",
        92: "Veggie Black Bean Quesadillas",
        97: "Creamy Chicken Enchilada Skillet",
        98: "Beef Enchilada Casserole",
        99: "Street Corn Chicken Burrito Bowls",
        102: "Creamy White Chicken Chili",
        107: "Smoky Red Beans and Rice",
        108: "Calabacitas Bean Skillet",
        109: "Spiced Lentil Rice Pilaf",
        113: "Garlic Butter Shrimp and Broccoli",
        114: "Lemon Butter Baked Tilapia Packets",
        115: "Cajun Salmon Sheet Pan",
        116: "Spicy Tuna Tomato Pasta",
        117: "Cheesy Tuna Melt Quesadillas",
        122: "Miso Ginger Cod Rice Bowls",
        123: "Honey Soy Shrimp Rice Bowls",
        126: "Crispy Tofu Sushi Bowls",
        129: "Korean-Inspired Beef Sesame Rice Bowls",
        130: "Korean-Inspired Chicken Cabbage Bowls",
        131: "Korean-Inspired Salmon Rice Bowls",
        134: "Teriyaki Shrimp Pineapple Rice Bowls",
        135: "Teriyaki Tofu Green Bean Bowls",
        136: "Miso Salmon Bok Choy Bowls",
        137: "Ginger Sesame Tuna Rice Bowls",
        141: "Chili Garlic Beef Rice Bowls",
        142: "Sesame Salmon Avocado Rice Bowls",
        143: "Sweet Soy Shrimp Carrot Bowls",
        208: "Poblano Bean Enchiladas",
        144: "Garlic Sesame Chicken Noodle Bowls",
        146: "Miso Butter Salmon Noodles",
        147: "Chili Garlic Beef Noodles",
        148: "Teriyaki Tofu Noodle Bowls",
        150: "Sesame Peanut Chicken Noodles",
        151: "Sesame Edamame Udon Bowls",
        153: "Ginger Garlic Pork Noodles",
        154: "Soy Mushroom Cabbage Noodles",
        155: "Coconut Curry Chicken Noodles",
        158: "Teriyaki Salmon Noodle Bowls",
        159: "Chili Sesame Tofu Noodles",
        160: "Black Pepper Beef Broccoli Stir-Fry",
        161: "Garlic Sesame Shrimp Stir-Fry",
        163: "Teriyaki Tofu Broccoli Stir-Fry",
        165: "Sesame Green Bean Pork Stir-Fry",
        166: "Soy Ginger Mushroom Cabbage Stir-Fry",
        167: "Honey Soy Chicken Pepper Stir-Fry",
        168: "Miso Shrimp Vegetable Stir-Fry",
        198: "Chipotle Shrimp Tacos",
        204: "Salsa Verde Shrimp Rice Bowls",
        227: "Beef Fajita Rice Bowls",
        171: "Ginger Carrot Chicken Stir-Fry",
        173: "Sriracha Garlic Shrimp Cabbage Stir-Fry",
        174: "Salmon Edamame Fried Rice",
        178: "Beef Broccoli Fried Rice",
        245: "Creamy Poblano Chicken Bowls",
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
