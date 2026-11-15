"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export type Q = { text: string; topic: string };
export type R = { name: string; tips: string; questions: Q[] };
export const emptyRound = (): R => ({ name: "", tips: "", questions: [{ text: "", topic: "" }] });

/** Round-by-round editor shared by the submit form and the edit form. */
export function RoundsEditor({ rounds, onChange }: { rounds: R[]; onChange: (next: R[]) => void }) {
  const setRound = (i: number, patch: Partial<R>) => onChange(rounds.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const setQ = (i: number, j: number, patch: Partial<Q>) =>
    onChange(rounds.map((r, k) => (k === i ? { ...r, questions: r.questions.map((q, m) => (m === j ? { ...q, ...patch } : q)) } : r)));

  /* Design source: Stitch "Share Your Interview", round blocks: "ROUND 01" tag, name, question + topic rows, a tip box, Remove round, and a dashed "Add another round" bar. */
  return (
    <div className="rounds-edit">
      {rounds.map((r, i) => (
        <fieldset key={i} className="redit">
          <legend>Round {String(i + 1).padStart(2, "0")}</legend>
          <label><span>Round name</span><input required value={r.name} onChange={(e) => setRound(i, { name: e.target.value })} placeholder="Online test, Technical interview, HR…" /></label>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Questions asked and topic</p>
            {r.questions.map((q, j) => (
              <div key={j} className="qrow">
                <label><span className="sr-only">Question</span><input value={q.text} onChange={(e) => setQ(i, j, { text: e.target.value })} placeholder="What were you asked?" /></label>
                <label><span className="sr-only">Topic</span><input value={q.topic} maxLength={60} onChange={(e) => setQ(i, j, { topic: e.target.value })} placeholder="Topic, e.g. Arrays" /></label>
                <Button type="button" variant="quiet" size="sm" aria-label="Remove question" onClick={() => setRound(i, { questions: r.questions.filter((_, m) => m !== j) })}><Icon name="close" className="!text-base" /></Button>
              </div>
            ))}
            <Button type="button" variant="quiet" size="sm" onClick={() => setRound(i, { questions: [...r.questions, { text: "", topic: "" }] })}><Icon name="add" className="!text-base" />Add a question</Button>
          </div>
          <label><span>Tip for this round (optional)</span><input value={r.tips} onChange={(e) => setRound(i, { tips: e.target.value })} placeholder="What would you tell a junior about this round?" /></label>
          {rounds.length > 1 && <div><Button type="button" variant="danger" size="sm" onClick={() => onChange(rounds.filter((_, k) => k !== i))}><Icon name="delete" className="!text-base" />Remove round</Button></div>}
        </fieldset>
      ))}
      {rounds.length < 12 && (
        <button type="button" onClick={() => onChange([...rounds, emptyRound()])} className="w-full border-2 border-dashed border-outline-variant rounded-2xl py-4 text-sm font-semibold text-primary hover:bg-surface-container-low cursor-pointer flex items-center justify-center gap-2">
          <Icon name="add_circle" className="!text-lg" />Add another round
        </button>
      )}
    </div>
  );
}
