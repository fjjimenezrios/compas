from flamenco_study import ESTUDIO_DIR
from flamenco_study.palos import list_palos


def palos_with_forms():
    return [p for p in list_palos() if p.get("forms")]


def test_every_form_fits_its_cycle():
    for palo in palos_with_forms():
        for form in palo["forms"]:
            cycle = form.get("cycle_len", palo["cycle_len"])
            where = f"{palo['id']}/{form['id']}"
            assert cycle, where
            assert form["accents"] and all(1 <= a <= cycle for a in form["accents"]), where
            assert all(1 <= w <= cycle for w in form.get("weak", [])), where
            assert not set(form["accents"]) & set(form.get("weak", [])), where
            assert 1 <= form["count_start"] <= cycle, where
            assert form["explain"].strip(), where


def test_every_palo_with_forms_has_a_study_guide():
    for palo in palos_with_forms():
        guide = ESTUDIO_DIR / f"{palo['id']}.md"
        assert guide.exists(), palo["id"]
        assert "\n## " in "\n" + guide.read_text(), palo["id"]


def test_verified_palos_name_their_sources():
    for palo in list_palos():
        if palo["status"] == "verified":
            assert palo["sources"] and palo["cycle_len"] and palo["accents"], palo["id"]
