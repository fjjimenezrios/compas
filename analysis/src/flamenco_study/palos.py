import json
from pathlib import Path

from flamenco_study import PALOS_DIR


def load_palo(palo_id: str, palos_dir: Path = PALOS_DIR) -> dict:
    path = palos_dir / f"{palo_id}.json"
    if not path.exists():
        available = ", ".join(sorted(p.stem for p in palos_dir.glob("*.json")))
        raise ValueError(f"Palo desconocido: {palo_id!r}. Disponibles: {available}")
    palo = json.loads(path.read_text())
    if not palo.get("cycle_len"):
        raise ValueError(f"El palo {palo_id!r} aún no tiene ciclo definido (status {palo.get('status')}).")
    return {"id": palo_id, **palo}


def list_palos(palos_dir: Path = PALOS_DIR) -> list[dict]:
    return [{"id": p.stem, **json.loads(p.read_text())} for p in sorted(palos_dir.glob("*.json"))]
