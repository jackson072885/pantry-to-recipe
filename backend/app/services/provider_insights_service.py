from __future__ import annotations

from app.services import pantry_service, search_service
from app.services.recommendation_service import recommend_recipes


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return round(max(low, min(high, value)), 2)


def _band(score: float) -> str:
    if score >= 75:
        return "strong"
    if score >= 50:
        return "stable"
    if score >= 30:
        return "watch"
    return "critical"


def build_provider_summary(db, payload) -> dict:
    pantry = pantry_service.list_pantry(db)
    filter_options = search_service.get_filter_options(db)

    pantry_names = {item["ingredient"] for item in pantry}
    low_stock_count = sum(1 for item in pantry if float(item["quantity"]) <= 1.5)
    focus = {item.strip().lower() for item in payload.focus_ingredients if item.strip()}
    focus_overlap = len({name.lower() for name in pantry_names} & focus)

    demand_pressure = float(payload.adjustments.get("demand_pressure", 0.0))
    supply_pressure = float(payload.adjustments.get("supply_pressure", 0.0))

    health_score = _clamp(
        62.0
        + (len(pantry) * 2.4)
        + (focus_overlap * 3.5)
        - (low_stock_count * 4.0)
        - (demand_pressure * 12.0)
        + (supply_pressure * 10.0)
    )
    scarcity_risk = _clamp(
        28.0
        + (low_stock_count * 6.0)
        + max(0.0, demand_pressure - supply_pressure) * 25.0
        - (focus_overlap * 3.0)
    )

    highlights = [
        f"Pantry inventory currently tracks {len(pantry)} active items.",
        f"Low-stock signals detected on {low_stock_count} items.",
        f"Coverage against focus ingredients: {focus_overlap}.",
        f"Known ingredient universe size: {len(filter_options.get('ingredients', []))}.",
    ]

    return {
        "provider_id": payload.provider_id,
        "window_days": payload.window_days,
        "health_score": health_score,
        "scarcity_risk": scarcity_risk,
        "readiness_band": _band(health_score),
        "pantry_snapshot": {
            "item_count": len(pantry),
            "low_stock_count": low_stock_count,
            "focus_overlap": focus_overlap,
        },
        "highlights": highlights,
    }


def build_damage_insight(payload) -> dict:
    domain_weight = {
        "supply": 1.2,
        "demand": 1.0,
        "logistics": 1.1,
        "compliance": 0.9,
        "cost": 1.0,
    }

    domain_scores: dict[str, float] = {}
    for shock in payload.shocks:
        domain = shock.domain.strip().lower() or "unknown"
        weight = domain_weight.get(domain, 1.0)
        duration_factor = min(float(shock.duration_days) / 7.0, 3.0)
        contribution = float(shock.severity) * duration_factor * weight * 16.0
        domain_scores[domain] = domain_scores.get(domain, 0.0) + contribution

    aggregate = sum(domain_scores.values())
    damage_index = _clamp(float(payload.baseline_score) + aggregate)

    if damage_index >= 80:
        severity_band = "critical"
    elif damage_index >= 60:
        severity_band = "high"
    elif damage_index >= 35:
        severity_band = "moderate"
    else:
        severity_band = "low"

    affected_domains = [
        k
        for k, _ in sorted(domain_scores.items(), key=lambda item: (-item[1], item[0]))
    ]
    recommendations = [
        "Harden substitutions on top-risk ingredients.",
        "Increase monitoring cadence for impacted domains.",
        "Pre-stage a conservative supply buffer for next cycle.",
    ]

    return {
        "damage_index": damage_index,
        "severity_band": severity_band,
        "affected_domains": affected_domains,
        "recommendations": recommendations,
    }


def build_micro_forecast(db, payload) -> dict:
    pantry = pantry_service.list_pantry(db)
    pantry_names = [item["ingredient"] for item in pantry]
    matches = recommend_recipes(db, pantry_names)

    cookable_now = len(matches["cook_now"])
    almost_now = len(matches["almost_there"])
    focus = {name.strip().lower() for name in payload.focus_ingredients if name.strip()}
    pantry_lower = {name.lower() for name in pantry_names}
    focus_bonus = len(focus & pantry_lower)

    pressure = float(payload.demand_shift) - float(payload.supply_shift) + float(payload.volatility)

    forecast_score = _clamp(
        50.0
        + (cookable_now * 1.1)
        + (almost_now * 0.6)
        + (focus_bonus * 2.0)
        - (pressure * 22.0)
    )

    if forecast_score >= 58:
        trend = "up"
    elif forecast_score <= 42:
        trend = "down"
    else:
        trend = "flat"

    horizon_factor = float(payload.horizon_days) / 7.0
    cookable_projection = max(0, int(round(cookable_now + horizon_factor - (pressure * 2.5))))
    almost_projection = max(0, int(round(almost_now + (pressure * 1.5))))

    drivers = [
        f"Current cookable base: {cookable_now}",
        f"Current almost-ready set: {almost_now}",
        f"Pressure composite: {round(pressure, 3)}",
        f"Focus overlap contribution: {focus_bonus}",
    ]

    return {
        "horizon_days": payload.horizon_days,
        "forecast_score": forecast_score,
        "trend": trend,
        "cookable_projection": cookable_projection,
        "almost_projection": almost_projection,
        "drivers": drivers,
    }
