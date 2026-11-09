import type { RoundSpec } from "./textures";

/** Sample content only. Marked as a sample everywhere it is shown. */
export const SAMPLE_ROUNDS: (RoundSpec & { tip: string; text: string })[] = [
  { n: "01", name: "Online assessment", q: "Two array problems and one SQL query. Ninety minutes.", text: "Two array problems and one SQL query. Ninety minutes, no negative marking.", tip: "Do the SQL first. It is the quickest marks." },
  { n: "02", name: "Technical interview", q: "Reverse a linked list in place. Which edge cases did you test?", text: "Reverse a linked list in place. Which edge cases did you test? Time and space, out loud.", tip: "Say your tests before you run them." },
  { n: "03", name: "System design", q: "Sketch a URL shortener. Where does it break at ten times the traffic?", text: "Sketch a URL shortener. Where does it break at ten times the traffic?", tip: "Start with the read path." },
  { n: "04", name: "HR conversation", q: "Walk through one project you would redo.", text: "Walk through one project you would redo. Why this team?", tip: "Have a specific answer to the second one." },
];
