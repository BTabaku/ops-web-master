export const DEFAULT_POLL_URL =
  "https://myfuturengo.wordpress.com/2026/05/11/871/";

export const DEFAULT_ANSWER = "David";

export const knownAnswers = [
  { answerId: "74310880", label: "Alvin" },
  { answerId: "74310889", label: "AMS" },
  { answerId: "74310891", label: "Baca" },
  { answerId: "74310892", label: "David" },
  { answerId: "74310893", label: "Juli" },
  { answerId: "74310900", label: "Koja" },
  { answerId: "74310901", label: "Luis" },
  { answerId: "74310902", label: "Santiliano" },
  { answerId: "74310916", label: "Sejgi" },
  { answerId: "74310917", label: "Simple M" }
] as const;

export type KnownAnswer = (typeof knownAnswers)[number]["label"];
