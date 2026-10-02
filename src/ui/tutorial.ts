import { t, type StringKey } from "../i18n";

interface Step {
  text: StringKey;
  focus: string[];
}

const STEPS: Step[] = [
  { text: "tut1", focus: ["#tray-tile"] },
  { text: "tut2", focus: ["#rot-left", "#rot-right"] },
  { text: "tut3", focus: ["#tray"] },
  { text: "tut4", focus: [] },
];

const DONE_KEY = "clickton.tutorial";

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === "done";
  } catch {
    return true;
  }
}

export function startTutorial(): void {
  const root = document.getElementById("tutorial")!;
  const text = document.getElementById("tut-text")!;
  const count = document.getElementById("tut-step")!;
  const next = document.getElementById("tut-next")!;
  const skip = document.getElementById("tut-skip")!;
  let step = 0;

  const clearFocus = () => document.querySelectorAll(".tut-focus").forEach((el) => el.classList.remove("tut-focus"));
  const finish = () => {
    clearFocus();
    root.classList.remove("open");
    try {
      localStorage.setItem(DONE_KEY, "done");
    } catch {}
  };
  const show = () => {
    clearFocus();
    const s = STEPS[step];
    text.textContent = t(s.text);
    count.textContent = `${step + 1} / ${STEPS.length}`;
    next.textContent = step === STEPS.length - 1 ? t("tutDone") : t("tutNext");
    skip.style.visibility = step === STEPS.length - 1 ? "hidden" : "visible";
    root.classList.toggle("centered", s.focus.length === 0);
    for (const sel of s.focus) document.querySelector(sel)?.classList.add("tut-focus");
  };
  next.onclick = () => {
    if (step === STEPS.length - 1) finish();
    else {
      step++;
      show();
    }
  };
  skip.onclick = finish;
  skip.textContent = t("tutSkip");
  root.classList.add("open");
  show();
}
