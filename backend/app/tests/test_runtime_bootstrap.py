from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

from app.core import config as config_module


def test_default_database_url_uses_repo_runtime_dir_without_copying_legacy_db(
    tmp_path,
    monkeypatch,
) -> None:
    runtime_root = tmp_path / ".runtime"
    default_db_path = runtime_root / "pantry.db"
    legacy_db_path = tmp_path / "pantry.db"
    legacy_db_path.write_text("legacy-seed", encoding="utf-8")

    monkeypatch.setattr(config_module, "RUNTIME_ROOT", runtime_root)
    monkeypatch.setattr(config_module, "DEFAULT_DB_PATH", default_db_path)
    monkeypatch.setattr(config_module, "LEGACY_DB_PATH", legacy_db_path)

    url = config_module._default_database_url()

    assert url == f"sqlite:///{default_db_path.as_posix()}"
    assert runtime_root.exists()
    assert not default_db_path.exists()
    assert legacy_db_path.read_text(encoding="utf-8") == "legacy-seed"


def test_bootstrap_runtime_state_is_reproducible_for_a_fresh_database(tmp_path) -> None:
    backend_root = Path(__file__).resolve().parents[2]
    db_path = tmp_path / "bootstrap-test.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"

    command = [
        sys.executable,
        "-c",
        (
            "import json; "
            "from app.services.runtime_bootstrap_service import bootstrap_runtime_state; "
            "print(json.dumps(bootstrap_runtime_state(), sort_keys=True))"
        ),
    ]

    first = subprocess.run(
        command,
        cwd=backend_root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    first_summary = json.loads(first.stdout.strip().splitlines()[-1])

    second = subprocess.run(
        command,
        cwd=backend_root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    second_summary = json.loads(second.stdout.strip().splitlines()[-1])

    assert Path(first_summary["canonical_recipe_source"]).name == "recipes_real_v1.json"
    assert Path(first_summary["canonical_recipe_source"]).exists()
    assert first_summary["database_path"] == str(db_path)
    assert first_summary["seed"]["seed"]["created"] > 0
    assert second_summary["seed"]["seed"]["created"] == 0
    assert second_summary["seed"]["seed"]["updated"] >= first_summary["seed"]["seed"]["total_source"]

    with sqlite3.connect(db_path) as connection:
        count = connection.execute(
            "select count(*) from recipes where name = ? and is_production_ready = 1",
            ("Skillet Chicken Ginger Rice",),
        ).fetchone()[0]

    assert count == 1


def test_legacy_database_path_is_rejected_without_explicit_override() -> None:
    backend_root = Path(__file__).resolve().parents[2]
    legacy_db_path = backend_root / "pantry.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{legacy_db_path.as_posix()}"
    env.pop("ALLOW_LEGACY_DATABASE_PATH", None)

    command = [
        sys.executable,
        "-c",
        "from app.core.config import settings; print(settings.database_url)",
    ]

    result = subprocess.run(
        command,
        cwd=backend_root,
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "legacy backend/pantry.db" in (result.stderr + result.stdout)


def test_legacy_database_path_can_be_used_only_with_explicit_override() -> None:
    backend_root = Path(__file__).resolve().parents[2]
    legacy_db_path = backend_root / "pantry.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{legacy_db_path.as_posix()}"
    env["ALLOW_LEGACY_DATABASE_PATH"] = "true"

    command = [
        sys.executable,
        "-c",
        "from app.core.config import settings; print(settings.database_url)",
    ]

    result = subprocess.run(
        command,
        cwd=backend_root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )

    assert result.stdout.strip() == f"sqlite:///{legacy_db_path.as_posix()}"


def test_canonical_sync_detects_drift_updates_changed_rows_and_prunes_stale_rows(tmp_path) -> None:
    backend_root = Path(__file__).resolve().parents[2]
    db_path = tmp_path / "canonical-sync.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"

    payload_v1 = json.dumps(
        [
            {
                "name": "Weeknight Lemon Chicken",
                "required": ["chicken", "rice"],
                "optional": ["lemon", "garlic"],
                "cook_method": "skillet",
                "prep_time_minutes": 10,
                "cook_time_minutes": 15,
                "total_time_minutes": 25,
                "servings": 2,
                "instructions": "Cook the chicken until browned. Simmer with rice until tender. Finish with lemon before serving.",
                "cuisine": "american",
                "difficulty": "easy",
                "tags": ["30_min", "easy", "budget", "one_pan"],
            },
            {
                "name": "Fast Bean Rice Bowl",
                "required": ["beans", "rice"],
                "optional": ["hot sauce"],
                "cook_method": "stovetop",
                "prep_time_minutes": 5,
                "cook_time_minutes": 12,
                "total_time_minutes": 17,
                "servings": 2,
                "instructions": "Warm the beans in a pot. Cook the rice until tender. Spoon the beans over rice and serve hot.",
                "cuisine": "mexican",
                "difficulty": "easy",
                "tags": ["30_min", "easy", "budget", "one_pot", "bean_forward"],
            },
        ]
    )
    payload_v2 = json.dumps(
        [
            {
                "name": "Weeknight Lemon Chicken",
                "required": ["chicken", "rice"],
                "optional": ["lemon", "garlic", "spinach"],
                "cook_method": "skillet",
                "prep_time_minutes": 10,
                "cook_time_minutes": 18,
                "total_time_minutes": 28,
                "servings": 2,
                "instructions": "Cook the chicken until browned. Simmer with rice until tender. Fold in spinach and finish with lemon before serving.",
                "cuisine": "american",
                "difficulty": "easy",
                "tags": ["30_min", "easy", "budget", "one_pan"],
            }
        ]
    )

    script = f"""
import json
import os
import sqlite3

os.environ["DATABASE_URL"] = "sqlite:///{db_path.as_posix()}"

from app.db import SessionLocal, ensure_schema
import app.services.real_recipe_pack_service as svc

payload_v1 = json.loads({payload_v1!r})
payload_v2 = json.loads({payload_v2!r})

ensure_schema()
svc._load_source_payload = lambda: payload_v1
db = SessionLocal()
first_summary = svc.seed_real_recipe_pack(db)
first_drift = svc.inspect_canonical_recipe_drift(db)
db.close()

svc._load_source_payload = lambda: payload_v2
db = SessionLocal()
drift_before_second = svc.inspect_canonical_recipe_drift(db)
second_summary = svc.seed_real_recipe_pack(db)
second_drift = svc.inspect_canonical_recipe_drift(db)
db.close()

with sqlite3.connect(r"{db_path.as_posix()}") as connection:
    rows = connection.execute(
        "select name, source_recipe_key, source_payload_hash, instructions from recipes order by name"
    ).fetchall()
    recipe_count = connection.execute(
        "select count(*) from recipes where source_dataset = ?",
        (svc.CANONICAL_SOURCE_NAME,),
    ).fetchone()[0]
    bean_recipe_count = connection.execute(
        "select count(*) from recipes where source_recipe_key = ?",
        ("fast bean rice bowl",),
    ).fetchone()[0]
    state_hash = connection.execute(
        "select value from runtime_bootstrap_state where key = ?",
        (svc.RUNTIME_STATE_DATASET_HASH_KEY,),
    ).fetchone()[0]

print(json.dumps({{
    "first_summary": first_summary,
    "first_drift": first_drift,
    "drift_before_second": drift_before_second,
    "second_summary": second_summary,
    "second_drift": second_drift,
    "rows": rows,
    "recipe_count": recipe_count,
    "bean_recipe_count": bean_recipe_count,
    "state_hash": state_hash,
}}, sort_keys=True))
"""

    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=backend_root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    summary = json.loads(result.stdout.strip().splitlines()[-1])

    assert summary["first_summary"]["created"] == 2
    assert summary["first_summary"]["pruned_managed_count"] == 0
    assert summary["first_drift"]["drift_detected"] is False

    assert summary["drift_before_second"]["drift_detected"] is True
    assert summary["drift_before_second"]["extra_keys"] == ["fast bean rice bowl"]
    assert summary["drift_before_second"]["changed_keys"] == ["weeknight lemon chicken"]

    assert summary["second_summary"]["created"] == 0
    assert summary["second_summary"]["updated"] == 1
    assert summary["second_summary"]["pruned_managed_count"] == 1
    assert summary["second_drift"]["drift_detected"] is False
    assert summary["recipe_count"] == 1
    assert summary["bean_recipe_count"] == 0
    assert summary["state_hash"] == summary["second_summary"]["dataset_hash"]
    assert any("Fold in spinach" in row[3] for row in summary["rows"])


def test_invalid_canonical_rows_fail_before_writing_runtime_state(tmp_path) -> None:
    backend_root = Path(__file__).resolve().parents[2]
    db_path = tmp_path / "invalid-canonical.db"
    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"

    invalid_payload = json.dumps(
        [
            {
                "name": "Broken Import Row",
                "required": ["chicken"],
                "optional": [],
                "cook_method": "skillet",
                "prep_time_minutes": 5,
                "cook_time_minutes": 10,
                "total_time_minutes": 15,
                "servings": 2,
                "instructions": "TODO",
                "cuisine": "american",
                "difficulty": "easy",
                "tags": ["15_min", "easy", "budget", "one_pan"],
            }
        ]
    )

    script = f"""
import json
import os
import sqlite3

os.environ["DATABASE_URL"] = "sqlite:///{db_path.as_posix()}"

from app.db import SessionLocal, ensure_schema
import app.services.real_recipe_pack_service as svc

ensure_schema()
svc._load_source_payload = lambda: json.loads({invalid_payload!r})

db = SessionLocal()
try:
    try:
        svc.seed_real_recipe_pack(db)
    except Exception as exc:
        db.rollback()
        with sqlite3.connect(r"{db_path.as_posix()}") as connection:
            recipe_count = connection.execute("select count(*) from recipes").fetchone()[0]
        print(json.dumps({{"error": str(exc), "recipe_count": recipe_count}}, sort_keys=True))
    else:
        raise AssertionError("seed_real_recipe_pack unexpectedly succeeded")
finally:
    db.close()
"""

    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=backend_root,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    summary = json.loads(result.stdout.strip().splitlines()[-1])

    assert "Broken Import Row" in summary["error"]
    assert summary["recipe_count"] == 0
