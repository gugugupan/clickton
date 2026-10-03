import { t } from "../i18n";

const ENDPOINT = "https://api.web3forms.com/submit";
const FALLBACK_EMAIL = ["guratan.game.asobu", "gmail.com"].join("@");
const LAST_KEY = "clickton.feedback.last";
const COOLDOWN_MS = 60_000;
const SUBJECT = "Clickton feedback";

export interface FeedbackContext {
  townLink: string;
  lang: string;
}

const key = import.meta.env.VITE_WEB3FORMS_KEY;

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function details(ctx: FeedbackContext): string {
  return [
    `Town: ${ctx.townLink}`,
    `Language: ${ctx.lang}`,
    `Build: ${import.meta.env.VITE_BUILD_SHA?.slice(0, 7) ?? "dev"}`,
    `Screen: ${innerWidth}x${innerHeight} @${devicePixelRatio}`,
    `Agent: ${navigator.userAgent}`,
  ].join("\n");
}

function mailto(ctx: FeedbackContext, message: string): string {
  const body = `${message}\n\n---\n${details(ctx)}`;
  return `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
}

function lastSent(): number {
  try {
    return Number(localStorage.getItem(LAST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function openFeedback(context: () => Promise<FeedbackContext>): void {
  if (!key) {
    void context().then((ctx) => (location.href = mailto(ctx, "")));
    return;
  }
  const status = $("fb-status");
  status.textContent = "";
  status.className = "fb-status";
  $("fb-mail").style.display = "none";
  ($("fb-send") as HTMLButtonElement).disabled = false;
  $("feedback").classList.add("open");
  setTimeout(() => ($("fb-message") as HTMLTextAreaElement).focus(), 50);

  $("fb-send").onclick = async () => {
    const message = ($("fb-message") as HTMLTextAreaElement).value.trim();
    const email = ($("fb-email") as HTMLInputElement).value.trim();
    if (!message) {
      status.textContent = t("feedbackEmpty");
      return;
    }
    if (Date.now() - lastSent() < COOLDOWN_MS) {
      status.textContent = t("feedbackWait");
      return;
    }
    if (($("fb-bot") as HTMLInputElement).checked) {
      status.textContent = t("feedbackThanks");
      status.className = "fb-status ok";
      setTimeout(closeFeedback, 1600);
      return;
    }
    const ctx = await context();
    const send = $("fb-send") as HTMLButtonElement;
    send.disabled = true;
    status.textContent = t("feedbackSending");
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: key,
          subject: `${SUBJECT} (${ctx.lang})`,
          from_name: "Clickton",
          ...(email ? { email, replyto: email } : {}),
          message: `${message}\n\n---\n${details(ctx)}`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (!res.ok || !data.success) throw new Error(String(res.status));
      try {
        localStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {}
      ($("fb-message") as HTMLTextAreaElement).value = "";
      status.textContent = t("feedbackThanks");
      status.className = "fb-status ok";
      setTimeout(closeFeedback, 1600);
    } catch {
      send.disabled = false;
      status.textContent = t("feedbackFailed");
      status.className = "fb-status bad";
      const link = $("fb-mail") as HTMLAnchorElement;
      link.href = mailto(ctx, message);
      link.style.display = "inline-block";
    }
  };
}

export function closeFeedback(): void {
  $("feedback").classList.remove("open");
}
