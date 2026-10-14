"""Build assets/data/foods.json for the on-device engine.

Sources:
  - INDB (Indian Nutrient Databank, Jaacks et al. 2024): ~1,000 cooked Indian recipes,
    per 100 g plus a household serving. https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-
  - scripts/foods-basic.json: hand-curated everyday staples (approximate, per serving),
    which take priority over INDB when names collide.

Usage (needs openpyxl):
  python scripts/build_foods.py <dir containing INDB.xlsx>
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "data" / "foods.json"
BASIC = ROOT / "scripts" / "foods-basic.json"

MAX_KCAL_100G = 650  # INDB counts all frying oil as absorbed; above this the row is unreliable.
MAX_SERVING_KCAL = 1000  # Some "servings" are whole recipes (e.g. a 4,800 kcal plate of pulao).
MAX_SERVING_G = 700


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def aliases_for(name: str) -> list[str]:
    """'Curd rice (Dahi bhaat/Dahi chawal)' -> ['curd rice', 'dahi bhaat', 'dahi chawal']."""
    parts = re.split(r"[()/,]", name)
    out = []
    for p in parts:
        p = clean(p).lower()
        if len(p) >= 3 and p not in out:
            out.append(p)
    return out


def r1(x: float) -> float:
    return round(float(x), 1)


def load_indb(src: Path) -> list[dict]:
    ws = openpyxl.load_workbook(src / "INDB.xlsx", read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    ix = {k: i for i, k in enumerate(rows[0])}
    foods = []
    for r in rows[1:]:
        kcal = r[ix["energy_kcal"]]
        if not r[ix["food_name"]] or kcal is None or kcal > MAX_KCAL_100G:
            continue
        name = clean(str(r[ix["food_name"]]))
        food = {
            "id": r[ix["food_code"]],
            "n": name,
            "a": aliases_for(name),
            "k": r1(kcal),
            "p": r1(r[ix["protein_g"]] or 0),
            "c": r1(r[ix["carb_g"]] or 0),
            "f": r1(r[ix["fat_g"]] or 0),
            "s": [],
        }
        unit = r[ix["servings_unit"]]
        s_kcal = r[ix["unit_serving_energy_kcal"]]
        if unit and s_kcal and kcal > 0:
            grams = s_kcal / kcal * 100
            if s_kcal <= MAX_SERVING_KCAL and 5 <= grams <= MAX_SERVING_G:
                food["s"].append([clean(str(unit)).lower(), round(grams)])
        foods.append(food)
    return foods


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    indb = load_indb(Path(sys.argv[1]))
    basic = json.loads(BASIC.read_text(encoding="utf-8"))
    for b in basic:
        b.setdefault("a", aliases_for(b["n"]))
        b.setdefault("s", [])
    foods = basic + indb
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(foods, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(basic)} basic + {len(indb)} INDB foods -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
