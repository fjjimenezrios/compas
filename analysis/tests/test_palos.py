import json

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


def test_quiz_questions_match_the_palo_data():
    quiz = json.loads((ESTUDIO_DIR / "quiz.json").read_text())
    palos = {p["id"]: p for p in list_palos()}
    assert len({q["id"] for q in quiz}) == len(quiz), "ids must be unique"
    for q in quiz:
        where = q["id"]
        palo = palos[q["palo"]]
        assert q["q"].strip() and q["explain"].strip() and q["source"].startswith("http"), where
        if q["type"] == "choice":
            assert len(q["options"]) >= 3 and len(set(q["options"])) == len(q["options"]), where
            assert 0 <= q["answer"] < len(q["options"]), where
        else:
            form = next(f for f in palo["forms"] if f["id"] == q["form"])
            cycle = form.get("cycle_len", palo["cycle_len"])
            assert q["cycle_len"] == cycle, where
            # the metronome plays the form, so the form's accents must be the right answer
            assert set(q["answer"]) == set(form["accents"]), where
    for palo in palos_with_forms():
        assert sum(q["palo"] == palo["id"] for q in quiz) >= 3, f"{palo['id']} needs at least 3 questions"


def test_bulerias_cajon_pattern_and_remate_fit_the_cycle():
    bulerias = next(p for p in list_palos() if p["id"] == "bulerias")
    traditional = next(f for f in bulerias["forms"] if f["id"] == "tradicional")
    assert {int(k) for k in bulerias["cajon"]} == set(traditional["accents"])
    assert set(bulerias["cajon"].values()) <= {"G", "A"}
    remate = bulerias["remate"]
    assert all(1 <= b <= bulerias["cycle_len"] for b in remate["beats"])
    assert {int(k) for k in remate["cajon"]} == set(remate["beats"])
