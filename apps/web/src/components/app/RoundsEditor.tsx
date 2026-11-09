"use client";

export type Q = { text: string; topic: string };
export type R = { name: string; tips: string; questions: Q[] };
export const emptyRound = (): R => ({ name: "", tips: "", questions: [{ text: "", topic: "" }] });

/** Round-by-round editor shared by the submit form and the edit form. */
export function RoundsEditor({ rounds, onChange }: { rounds: R[]; onChange: (next: R[]) => void }) {
  const setRound = (i: number, patch: Partial<R>) => onChange(rounds.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const setQ = (i: number, j: number, patch: Partial<Q>) =>
    onChange(rounds.map((r, k) => (k === i ? { ...r, questions: r.questions.map((q, m) => (m === j ? { ...q, ...patch } : q)) } : r)));

  return (
    <div className="rounds-edit">
      {rounds.map((r, i) => (
        <fieldset key={i} className="redit">
          <legend className="mono">Round {String(i + 1).padStart(2, "0")}</legend>
          <label><span className="mono">Name</span><input required value={r.name} onChange={(e) => setRound(i, { name: e.target.value })} placeholder="Technical interview" /></label>
          {r.questions.map((q, j) => (
            <div key={j} className="qrow">
              <label><span className="mono">Question</span><input value={q.text} onChange={(e) => setQ(i, j, { text: e.target.value })} /></label>
              <label><span className="mono">Topic</span><input value={q.topic} maxLength={60} onChange={(e) => setQ(i, j, { topic: e.target.value })} placeholder="Arrays" /></label>
              <button type="button" className="btn btn-ghost small" aria-label="Remove question" onClick={() => setRound(i, { questions: r.questions.filter((_, m) => m !== j) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost small" onClick={() => setRound(i, { questions: [...r.questions, { text: "", topic: "" }] })}>Add a question</button>
          <label><span className="mono">Tip for this round</span><input value={r.tips} onChange={(e) => setRound(i, { tips: e.target.value })} /></label>
          {rounds.length > 1 && <button type="button" className="btn btn-ghost small" onClick={() => onChange(rounds.filter((_, k) => k !== i))}>Remove this round</button>}
        </fieldset>
      ))}
      {rounds.length < 12 && <button type="button" className="btn btn-ghost" onClick={() => onChange([...rounds, emptyRound()])}>Add a round</button>}
    </div>
  );
}
