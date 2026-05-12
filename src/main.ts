import { DEFAULT_ANSWER, DEFAULT_POLL_URL, knownAnswers } from "./poll-config";
import { answerIdSelector, answerSelector } from "./selector";
import "./styles.css";

const selected = knownAnswers.find((answer) => answer.label === DEFAULT_ANSWER);
const defaultSelector = selected
  ? answerIdSelector(selected.answerId, selected.label)
  : answerSelector(DEFAULT_ANSWER);

function commandFor(answer: string) {
  const escaped = answer.replaceAll('"', '\\"');
  return `npm run guide -- --answer "${escaped}" --refresh-seconds 30 --pre-refresh-pause-seconds 5`;
}

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <section class="shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">Cross-platform poll helper</p>
        <h1>Poll Navigator</h1>
      </div>
      <a class="icon-link" href="${DEFAULT_POLL_URL}" target="_blank" rel="noreferrer" aria-label="Open poll">
        <span aria-hidden="true">↗</span>
      </a>
    </header>

    <section class="workspace" aria-label="Poll target">
      <div class="target-panel">
        <div>
          <p class="label">Target page</p>
          <a class="url" href="${DEFAULT_POLL_URL}" target="_blank" rel="noreferrer">${DEFAULT_POLL_URL}</a>
        </div>
        <button id="openPoll" type="button">Open Page</button>
      </div>

      <div class="answer-grid" aria-label="Poll answers">
        ${knownAnswers
          .map(
            (answer) => `
              <button
                class="answer ${answer.label === DEFAULT_ANSWER ? "selected" : ""}"
                type="button"
                aria-pressed="${answer.label === DEFAULT_ANSWER}"
                data-answer="${answer.label}"
                data-answer-id="${answer.answerId}"
              >
                <span>${answer.label}</span>
                <small>${answer.answerId}</small>
              </button>
            `
          )
          .join("")}
      </div>

      <section class="command-strip" aria-label="Desktop command">
        <div>
          <p class="label">Desktop guided mode</p>
          <code id="guideCommand">${commandFor(DEFAULT_ANSWER)}</code>
        </div>
        <button id="copyCommand" type="button">Copy</button>
      </section>
    </section>

    <aside class="details" aria-label="Selection details">
      <div class="status-dot" aria-hidden="true"></div>
      <div>
        <p class="label">Selected option</p>
        <h2 id="selectedName">${DEFAULT_ANSWER}</h2>
        <p>
          Browser security prevents a static app from controlling another website.
          This app opens the poll and the desktop helper highlights the matching option,
          then the final submit action stays manual.
        </p>
        <dl>
          <div>
            <dt>Answer id</dt>
            <dd id="selectedAnswerId">${selected?.answerId ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Selector</dt>
            <dd><code id="selectedSelector">${defaultSelector}</code></dd>
          </div>
        </dl>
      </div>
    </aside>
  </section>
`;

document.querySelector<HTMLButtonElement>("#openPoll")?.addEventListener("click", () => {
  window.open(DEFAULT_POLL_URL, "_blank", "noopener,noreferrer");
});

function selectAnswer(button: HTMLButtonElement) {
  const answer = button.dataset.answer ?? DEFAULT_ANSWER;
  const answerId = button.dataset.answerId ?? "";
  const selector = answerId ? answerIdSelector(answerId, answer) : answerSelector(answer);
  const command = commandFor(answer);

  document.querySelectorAll<HTMLButtonElement>(".answer").forEach((item) => {
    const isSelected = item === button;
    item.classList.toggle("selected", isSelected);
    item.setAttribute("aria-pressed", String(isSelected));
  });

  document.querySelector("#selectedName")!.textContent = answer;
  document.querySelector("#selectedAnswerId")!.textContent = answerId || "Unknown";
  document.querySelector("#selectedSelector")!.textContent = selector;
  document.querySelector("#guideCommand")!.textContent = command;
}

document.querySelectorAll<HTMLButtonElement>(".answer").forEach((button) => {
  button.addEventListener("click", () => selectAnswer(button));
});

document
  .querySelector<HTMLButtonElement>("#copyCommand")
  ?.addEventListener("click", async (event) => {
    const command =
      document.querySelector<HTMLElement>("#guideCommand")?.textContent ??
      commandFor(DEFAULT_ANSWER);

    await navigator.clipboard.writeText(command);
    const button = event.currentTarget as HTMLButtonElement;
    const original = button.textContent;
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = original;
    }, 1200);
  });
