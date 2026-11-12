import { useEffect, useState } from "react";
import { fetchPalos, type Palo } from "../api";
import { beatsFeedback, fetchQuiz, isCorrect, shuffle, summarize, type Given, type Question } from "../quiz";
import { PALMAS_Y_CAJON } from "../rhythm";
import { MetronomeWheel } from "./MetronomeWheel";
import { startingTempo } from "./TempoControl";

export function QuizPage({ paloId }: { paloId?: string }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [palos, setPalos] = useState<Palo[]>([]);
  useEffect(() => {
    fetchQuiz().then(setQuestions, () => setQuestions([]));
    fetchPalos().then(setPalos, () => setPalos([]));
  }, []);
  if (!questions) return null;
  return <QuizBody key={paloId ?? "todos"} all={questions} palos={palos} paloId={paloId} />;
}

const hostOf = (url: string) => new URL(url).hostname.replace("www.", "");

function QuizBody({ all, palos, paloId }: { all: Question[]; palos: Palo[]; paloId?: string }) {
  const pool = paloId ? all.filter((q) => q.palo === paloId) : all;
  const [queue, setQueue] = useState(() => shuffle(pool));
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<Given>(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [listening, setListening] = useState(false);

  const withQuestions = [...new Set(all.map((q) => q.palo))];
  const nameOf = (id: string) => palos.find((p) => p.id === id)?.name ?? id;
  const question = queue[index];

  const restart = (next: Question[]) => {
    setQueue(shuffle(next));
    setIndex(0);
    setGiven(null);
    setChecked(false);
    setResults({});
    setListening(false);
  };

  const check = () => {
    setResults({ ...results, [question.id]: isCorrect(question, given) });
    setChecked(true);
  };
  const next = () => {
    setIndex(index + 1);
    setGiven(null);
    setChecked(false);
    setListening(false);
  };

  const head = (
    <header className="page-head">
      <h1>Test</h1>
      <p className="muted">Preguntas rápidas sacadas de las guías. Responde y compruébalo con el metrónomo.</p>
      <div className="chips" role="group" aria-label="Palo">
        <a className="chip" href="#test" aria-pressed={!paloId}>Todos</a>
        {withQuestions.map((id) => (
          <a key={id} className="chip" href={`#test/${id}`} aria-pressed={paloId === id}>{nameOf(id)}</a>
        ))}
      </div>
    </header>
  );

  if (!pool.length) {
    return <section>{head}<p className="muted">Todavía no hay preguntas para este palo.</p></section>;
  }

  if (!question) {
    const { correct, total } = summarize(results);
    const failed = queue.filter((q) => results[q.id] === false);
    return (
      <section>
        {head}
        <div className="panel quiz-result">
          <span className="eyebrow">Resultado</span>
          <h2>{correct} de {total}</h2>
          <p>{correct === total ? "¡Todo bien! Domina estos palos." : correct >= total / 2 ? "Vas bien. Repasa lo que has fallado." : "Merece la pena repasar las guías y volver a intentarlo."}</p>
          {failed.length > 0 && (
            <ul className="quiz-failed">
              {failed.map((q) => (
                <li key={q.id}><b>{q.q}</b><span className="muted">{q.explain}</span></li>
              ))}
            </ul>
          )}
          <div className="quiz-actions">
            {failed.length > 0 && <button className="chip accent" onClick={() => restart(failed)}>Repetir los fallos</button>}
            <button className="chip" onClick={() => restart(pool)}>Empezar de nuevo</button>
          </div>
        </div>
      </section>
    );
  }

  const palo = palos.find((p) => p.id === question.palo);
  const form = palo?.forms?.find((f) => f.id === question.form);
  const right = question.type === "beats" ? (question.answer as number[]) : [];
  const chosenBeats = Array.isArray(given) ? given : [];
  const ok = results[question.id];
  const feedback = question.type === "beats" ? beatsFeedback(right, chosenBeats) : null;
  const cycle = question.cycle_len ?? 12;

  return (
    <section>
      {head}
      <div className="panel quiz-card">
        <div className="quiz-progress">
          <span className="mono">Pregunta {index + 1} de {queue.length}</span>
          <span className="chip">{nameOf(question.palo)}</span>
          <progress max={queue.length} value={index + (checked ? 1 : 0)} aria-label="Progreso del test" />
        </div>

        <h2>{question.q}</h2>

        {question.type === "choice" ? (
          <div className="quiz-options" role="group" aria-label="Respuestas">
            {question.options!.map((option, i) => {
              const state = checked ? (i === question.answer ? "right" : i === given ? "wrong" : "") : "";
              return (
                <button key={i} className={`quiz-option ${state}`} aria-pressed={given === i} disabled={checked} onClick={() => setGiven(i)}>
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <p className="muted">Toca los tiempos del ciclo (1 a {cycle}) que correspondan.</p>
            <div className="beat-picker" role="group" aria-label="Tiempos">
              {Array.from({ length: cycle }, (_, k) => k + 1).map((b) => {
                const on = chosenBeats.includes(b);
                const state = checked ? (right.includes(b) ? "right" : on ? "wrong" : "") : "";
                return (
                  <button
                    key={b}
                    className={`beat-btn ${state}`}
                    aria-pressed={on}
                    disabled={checked}
                    onClick={() =>
                      setGiven((g) => {
                        const now = Array.isArray(g) ? g : [];
                        return now.includes(b) ? now.filter((x) => x !== b) : [...now, b];
                      })
                    }
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!checked ? (
          <button className="play-big quiz-check" onClick={check} disabled={given === null || (Array.isArray(given) && given.length === 0)}>
            Comprobar
          </button>
        ) : (
          <div className={`quiz-feedback ${ok ? "ok" : "bad"}`} role="status">
            <h3>{ok ? "¡Correcto!" : "No del todo"}</h3>
            {feedback && !ok && (
              <p>
                {feedback.missing.length > 0 && <>Te faltó: <b>{feedback.missing.join(", ")}</b>. </>}
                {feedback.extra.length > 0 && <>Sobraba: <b>{feedback.extra.join(", ")}</b>.</>}
              </p>
            )}
            <p>{question.explain}</p>
            <p className="sources muted">
              Fuente: <a href={question.source} target="_blank" rel="noopener noreferrer">{hostOf(question.source)}</a>
            </p>

            {palo && form && (
              <div className="quiz-listen">
                <div className="quiz-wheel">
                  <MetronomeWheel
                    cycleLen={cycle}
                    form={form}
                    countStart={form.count_start}
                    bpm={startingTempo(palo.tempo_bpm, palo.default_bpm)}
                    active={listening}
                    sounds={PALMAS_Y_CAJON}
                    cajon={palo.cajon}
                    remate={question.form === "remate" ? palo.remate : null}
                    remateEvery={question.form === "remate" ? 1 : 0}
                  />
                </div>
                <button className={listening ? "play-btn on" : "play-btn"} aria-pressed={listening} onClick={() => setListening(!listening)}>
                  {listening ? "Parar" : "Escúchalo con el metrónomo"}
                </button>
              </div>
            )}

            <button className="play-big quiz-next" onClick={next}>{index + 1 < queue.length ? "Siguiente" : "Ver resultado"}</button>
          </div>
        )}
      </div>
    </section>
  );
}
