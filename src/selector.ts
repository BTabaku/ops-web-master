/**
 * Returns a CSS selector string that matches the Crowdsignal vote button
 * by its `value` attribute (current DOM) AND by its legacy `answerid` attribute,
 * joined with a comma so Playwright's locator() matches either one.
 */
export function answerIdSelector(answerId: string, label: string): string {
  const safeId    = answerId.replaceAll('"', '\\"');
  const safeLabel = label.replaceAll('"', '\\"');
  // Primary: value-based (works today).  Secondary: answerid-based (legacy fallback).
  return [
    `input.crowdsignal-forms-poll__submit-button[value="${safeLabel}"]`,
    `input[value="${safeLabel}"]`,
    `input.crowdsignal-forms-poll__submit-button[answerid="${safeId}"]`,
    `input[answerid="${safeId}"]`,
  ].join(", ");
}

/**
 * Returns a CSS selector for an answer matched only by its label text (value=).
 * Used when the answer is not in the knownAnswers list.
 */
export function answerSelector(answer: string): string {
  const safe = answer.replaceAll('"', '\\"');
  return [
    `input.crowdsignal-forms-poll__submit-button[value="${safe}"]`,
    `input[value="${safe}"]`,
  ].join(", ");
}
