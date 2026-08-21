"use client";

import { useEffect, useState } from "react";
import { useExercises, usePlanItems, useProfile } from "@/lib/hooks";
import {
  collectReminderTargets,
  dueReminderTargets,
  markFired,
  readFiredKeys,
  reminderFireKey,
  showLocalNotification,
} from "@/lib/reminders";

export function ReminderHost() {
  const profile = useProfile();
  const planItems = usePlanItems();
  const exercises = useExercises();

  useEffect(() => {
    let active = true;

    async function tick() {
      if (!active || typeof window === "undefined") return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();
      const targets = collectReminderTargets(profile, planItems, exercises, now);
      const fired = readFiredKeys();
      const due = dueReminderTargets(targets, now, fired);
      if (due.length === 0) return;
      for (const target of due) {
        await showLocalNotification(target.title, target.body, "/");
      }
      markFired(due.map((target) => reminderFireKey(target.id, target.time, now)));
    }

    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [profile, planItems, exercises]);

  return null;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)");
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return media.matches || nav.standalone === true;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallHint() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    const dismissedAt = window.sessionStorage.getItem("iamfit-install-dismissed");
    if (dismissedAt) setDismissed(true);
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const safari = /safari/i.test(window.navigator.userAgent) && !/crios|fxios|android/i.test(window.navigator.userAgent);
    setIosHint(ios && safari && !isStandaloneDisplay());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || dismissed) return null;
  if (!promptEvent && !iosHint) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    setPromptEvent(null);
  }

  function dismiss() {
    setDismissed(true);
    window.sessionStorage.setItem("iamfit-install-dismissed", "1");
  }

  return (
    <div className="mb-4 rounded-[1.4rem] border border-sand bg-white/70 p-3 text-sm text-forest-dark">
      <p className="font-medium">Als App aufs Handy</p>
      <p className="mt-1 text-forest-light">
        {promptEvent
          ? "Dann bleibt die Erinnerung auf dem Home-Bildschirm, ohne Store."
          : "Im Teilen-Menü „Zum Home-Bildschirm“ wählen. Danach öffnet sich I am fit wie eine App."}
      </p>
      <div className="mt-2 flex gap-2">
        {promptEvent && (
          <button
            type="button"
            className="rounded-full bg-forest px-3 py-1.5 text-xs text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            onClick={install}
          >
            Installieren
          </button>
        )}
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-xs text-forest underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
          onClick={dismiss}
        >
          Später
        </button>
      </div>
    </div>
  );
}
