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
    repaired_target_names = {
        "Cheesy Baked Ziti",
        "Cheesy Beef Taco Skillet",
        "Garlic Alfredo Chicken Pasta",
        "Creamy Chicken Pot Pie Skillet",
        "Chicken Taco Rice Skillet",
        "Creamy Tomato Beef Pasta",
        "Ground Beef Quesadillas",
        "Mexican Bean and Corn Rice Skillet",
        "One Pot Sausage Marinara Pasta",
        "Pesto Chicken Pasta",
        "Skillet Chicken Ginger Rice",
        "Skillet Chicken Parmesan Pasta",
        "Skillet Lasagna Pasta",
        "Salsa Roja Beef Rice Skillet",
        "Cheesy Beef Enchilada Rice Skillet",
        "Soy Ginger Shrimp Lo Mein",
        "Creole Chicken Rice Skillet",
        "Beef Mushroom Skillet",
        "Weeknight Beef Ragu",
        "Tomato Chicken Curry",
        "Lentil Spinach Curry",
        "Lentil Tomato Stew",
        "Cheddar Broccoli Loaded Baked Potatoes",
        "Loaded Cheddar Chicken Potato Casserole",
        "Mediterranean Chickpea Skillet",
        "Minestrone Soup",
        "Sausage Bean Chili",
        "Soy Sesame Tofu Rice Bowl",
        "Golden Vegetable Curry",
        "Red Chicken Enchiladas",
        "Veggie Black Bean Quesadillas",
        "Creamy Chicken Enchilada Skillet",
        "Beef Enchilada Casserole",
        "Street Corn Chicken Burrito Bowls",
        "Creamy White Chicken Chili",
        "Smoky Red Beans and Rice",
        "Calabacitas Bean Skillet",
        "Spiced Lentil Rice Pilaf",
        "Garlic Butter Shrimp and Broccoli",
        "Lemon Butter Baked Tilapia Packets",
        "Cajun Salmon Sheet Pan",
        "Spicy Tuna Tomato Pasta",
        "Cheesy Tuna Melt Quesadillas",
        "Honey Soy Shrimp Rice Bowls",
        "Crispy Tofu Sushi Bowls",
        "Korean-Inspired Beef Sesame Rice Bowls",
        "Korean-Inspired Chicken Cabbage Bowls",
        "Miso Salmon Bok Choy Bowls",
        "Ginger Sesame Tuna Rice Bowls",
        "Poblano Bean Enchiladas",
        "Garlic Sesame Chicken Noodle Bowls",
        "Miso Butter Salmon Noodles",
        "Chili Garlic Beef Noodles",
        "Sesame Peanut Chicken Noodles",
        "Sesame Edamame Udon Bowls",
        "Ginger Garlic Pork Noodles",
        "Soy Mushroom Cabbage Noodles",
        "Coconut Curry Chicken Noodles",
        "Teriyaki Salmon Noodle Bowls",
        "Chili Sesame Tofu Noodles",
        "Black Pepper Beef Broccoli Stir-Fry",
        "Garlic Sesame Shrimp Stir-Fry",
        "Teriyaki Tofu Broccoli Stir-Fry",
        "Sesame Green Bean Pork Stir-Fry",
        "Honey Soy Chicken Pepper Stir-Fry",
        "Miso Shrimp Vegetable Stir-Fry",
        "Chipotle Shrimp Tacos",
        "Salsa Verde Shrimp Rice Bowls",
        "Beef Fajita Rice Bowls",
        "Ginger Carrot Chicken Stir-Fry",
        "Salmon Edamame Fried Rice",
        "Beef Broccoli Fried Rice",
        "Pork Cabbage Fried Rice",
        "Miso Glazed Salmon with Rice",
        "Sesame Ginger Salmon Sheet Pan",
        "Miso Butter Shrimp Foil Packets",
        "Sticky Soy Chicken Thigh Tray",
        "Japanese-Inspired Chicken Curry Rice",
        "Japanese-Inspired Beef Curry Bowls",
        "Lime Cabbage Shrimp Taco Bowls",
        "Chile Lime Tilapia Plates",
        "Roasted Corn Black Bean Bowls",
        "Tomato Braised Pork Tacos",
        "Creamy Poblano Chicken Bowls",
        "Bean and Cheese Enchilada Bake",
        "Beef Picadillo Rice Bowls",
        "Chile Lime Beef Tacos",
        "Beef Taco Soup",
        "Baked Ravioli with Sausage",
        "Crispy Bean Tostadas",
        "Creamy Tomato Beef Shells",
        "Fajita Veggie Taco Bowls",
        "Green Chile Beef Rice Bowls",
        "Queso Black Bean Burrito Bowls",
        "Roasted Veggie Pasta",
        "Street Corn Shrimp Bowls",
        "Street Corn Turkey Burrito Bowls",
        "Taco Spiced Salmon Bowls",
        "Teriyaki Salmon Edamame Bowls",
        "Turkey Chili",
        "White Bean Chicken Enchilada Soup",
        "Adobo Chicken Tacos",
        "BBQ Chicken Stuffed Potatoes",
        "Cajun Catfish Rice Bowls",
        "Chile Lime Bean Rice Bowls",
        "Crispy Potato Poblano Tacos",
        "Fajita Shrimp Burrito Bowls",
        "Garlic Herb Tilapia Rice Bowls",
        "Garlic Lime Fish Tacos",
        "Pinto Bean Sweet Potato Tacos",
        "Smoky Pork Taco Bowls",
        "BBQ Pork Sweet Potato Hash",
        "Coconut Tomato Lentil Curry",
        "Crispy Lemon Pan-Fried Bass",
        "Garlic Bok Choy Beef Stir-Fry",
        "Ginger Soy Salmon Cabbage Skillet",
        "Salsa Verde Chicken Burrito Bowl",
        "Smothered Pork and Rice",
        "Teriyaki Chicken Broccoli Bowls",
        "Tofu Carrot Fried Rice",
        "Tofu Veggie Stir Fry",
        "BBQ Chicken Rice Bowls",
        "Blackened Tilapia with Dirty Rice",
        "Chicken Tortilla Rice Soup",
        "Chipotle Salmon Rice Bowls",
        "Creole Shrimp Tomato Rice",
        "Mushroom Poblano Enchiladas",
        "Salsa Verde Turkey Burrito Bowls",
        "Smothered Chicken Onion Gravy",
        "Southern Sausage Potato Skillet",
        "Thai-Inspired Tofu Green Bean Curry",
        "BBQ Pork Rice Skillet",
        "Coconut Shrimp Curry",
        "Garlic Oregano Shrimp Rice Bowls",
        "Greek Stuffed Peppers",
        "Herbed Chickpea Rice Bowls",
        "Lemon Herb Chicken Rice Bowls",
        "Lemon Herb Salmon Rice Bowls",
        "Mediterranean Shrimp Rice Bake",
        "Mediterranean Tuna Rice Bowls",
        "Smoky BBQ Shrimp Tacos",
        "Chicken Mozzarella Bake",
        "Coconut Salmon Curry",
        "Garlic Spinach Lentil Curry",
        "Ginger Chicken Lentil Skillet",
        "Ginger Garlic Chicken Curry",
        "Meatball Pepper Bake",
        "Potato Pea Curry",
        "Tomato Cod Curry",
        "Turmeric Salmon Rice Bowls",
    }
    removed_target_names = {
        "Soy Ginger Mushroom Cabbage Stir-Fry",
        "Sriracha Garlic Shrimp Cabbage Stir-Fry",
        "Scallion Beef Rice Bowls",
        "Ginger Garlic White Fish Plates",
    }
    tie_break_survivor_names = {
        "Chicken Cabbage Stir Fry",
        "Mozzarella Chicken Parmesan Bake",
        "Spicy Shrimp Sushi Rice Bowls",
        "Miso Ginger Cod Rice Bowls",
        "Spicy Mayo Salmon Rice Bowls",
        "Cajun Chicken Pasta",
        "Chili Garlic Shrimp Fried Rice",
    }

    db = SessionLocal()
    try:
        report = audit_recipe_catalog(db)
        recipes_by_name = {row["recipe_name"]: row for row in report["recipes"]}

        for recipe_name in repaired_target_names:
            row = recipes_by_name[recipe_name]
            assert row["triage"] == "keep"
            assert row["triage_issues"] == []
        for recipe_name in tie_break_survivor_names:
            row = recipes_by_name[recipe_name]
            assert row["triage"] == "keep"
            assert row["triage_issues"] == []
        for recipe_name in removed_target_names:
            assert recipe_name not in recipes_by_name
    finally:
        db.close()
