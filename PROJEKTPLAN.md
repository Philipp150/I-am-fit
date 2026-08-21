# Projektplan – I am fit

Lebendes Dokument für Vision, Architektur und Phasen. Offene und erledigte Arbeit steht in [TODO.md](TODO.md). Erledigte Todo-Punkte bleiben dort abgehakt und werden nicht gelöscht.

## 1. Produkt

**I am fit** ist eine tägliche Übungs-App für Bewegung, Atem, Mantras und Rituale. Sie erinnert daran, dass man die Übungen *selbst* machen wollte – ohne Fitness-Zwang und ohne Schuldgefühl beim Auslassen.

Live: [i-am-super-fit.vercel.app](https://i-am-super-fit.vercel.app/)  
Quellcode: dieses Repository (`schlag-art/philipp150-I-am-fit`, Ursprung [github.com/Philipp150/I-am-fit](https://github.com/Philipp150/I-am-fit))

### Prinzipien

- Sanfte Erinnerung statt Druck: Serie und Verlauf sind Blick zurück, kein Score.
- Einheitliche Gliederpuppe (männlich, mit Gelenken) statt fremder Videos; Import liefert Metadaten, die Figur zeichnet die App neu. Originalvideo nur zusätzlich.
- Derselbe Plan auf PC und Handy, sobald Vercel + Supabase laufen (`plans`, `plan_invites` liegen live im Schema).
- Ohne Cloud bleibt die App lokal im Browser (IndexedDB) nutzbar.

## 2. Was die App kann

| Bereich | Inhalt |
| --- | --- |
| **Heute** | Fällige Plan-Übungen, Serie, Einstieg mit drei Ankern |
| **Sammlung** | Hierarchische Kategorien, Tags, Katalog und eigene Übungen |
| **Plan** | Mehrere Pläne (eigene und empfangene), Rhythmus, optionaler Zeitraum, aktiver Plan für Heute, Versand per E-Mail |
| **Beschwerden** | Symptom-Auswahl mit Vorschlägen aus dem Katalog |
| **Import** | YouTube- oder Instagram-Link → Titel/Beschreibung → Übungen als Gliederpuppe; Originalvideo nur zusätzlich |
| **Verlauf** | 28-Tage-Raster, letzte Completions, Anzeigename |
| **Konto** | Optionale E-Mail-Anmeldung über Supabase; ohne Login nur lokaler Speicher |

Katalogstand (Systemdaten): 18 Kategorien, 8 Beschwerden, 31 Übungen (Bewegung, Atem, Mantra, Achtsamkeit, Alltag).

## 3. Architektur

```
Browser / PWA
  ├── Next.js 15 (App Router, React 19, Tailwind)
  ├── IndexedDB (Dexie)          → Fallback ohne Cloud
  └── Supabase (Auth + Postgres) → Sync, wenn Env-Vars gesetzt
         ▲
Vercel   │ Hosting, Import-API (/api/import)
```

| Schicht | Technik |
| --- | --- |
| UI | `src/app/*`, `src/components/*` (PosePlayer + Gliederpuppe in `StickFigure.tsx`, Originalvideo in `SourceVideo.tsx`), Bottom-Nav |
| Domain | `src/lib/plan.ts`, `plan-share.ts`, `schedule.ts`, `catalog.ts`, `suggestions.ts`, `poses.ts` |
| Persistenz | `src/lib/repository.ts` schaltet zwischen Dexie und Supabase |
| Cloud | `supabase/setup.sql` (Schema inkl. `plans` / `plan_invites`, RLS, Seed), `@supabase/ssr`; Tabellen existieren im Live-Projekt |
| Import | `src/app/api/import/route.ts` + `extract-meta.ts` / `import-parse.ts` |
| PWA | `src/app/manifest.ts`, Raster-Icons 192/512, `public/sw.js` (Offline-Cache für App-Shell, Katalogseiten, Pose-JS; YouTube/Instagram bewusst **nicht**) |
| Native Hülle | Capacitor 7 (`capacitor.config.ts`, App-ID `art.schlag.iamfit`); `android/` und `ios/` laden `https://i-am-super-fit.vercel.app`, damit Import-API und Auth erreichbar bleiben. |

Datenmodell (Kern): `Category`, `Complaint`, `Exercise` (Schritte + Pose-IDs), `TrainingPlan` (mehrere Pläne pro Person, mit Urheber), `PlanItem` (gehört zu einem Plan), `PlanInvite` (Einladung per E-Mail), `Completion`, `Profile` (`activePlanId`). Erinnerungen (`reminderEnabled`, `reminderTime`, optional `PlanItem.reminderTime`) werden in Verlauf/Plan gesetzt und lösen lokale bzw. Web-Push-Notifications aus, solange die App oder die installierte PWA erreichbar ist.

Pläne können von einer anderen Person (z. B. Physiotherapie) zusammengestellt und an eine E-Mail geschickt werden. Die empfangende Person nimmt die Einladung in der App an; der bisherige Plan bleibt. Teilen braucht Cloud/Auth (Supabase). Ohne Cloud bleiben mehrere eigene Pläne lokal nutzbar.

## 4. Betrieb

| Dienst | Rolle |
| --- | --- |
| **Vercel** (Projekt `i-am-super-fit`, Hobby) | Next.js-Hosting, Import-API, Deploy bei Push auf `main` |
| **Supabase** (Free) | Postgres, RLS, Magic-Link/E-Mail-Auth |

Ohne Vercel nur lokal mit Node. Ohne Supabase nur dieser eine Browser.

Setup-Kurzfassung: `supabase/setup.sql` im SQL-Editor ausführen; Site-URL und Redirect `/auth/callback` setzen; in Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. Keine Secrets ins Repo oder in Cursor-Regeln. Das Live-Projekt hat `plans` und `plan_invites`; nach Schema-Änderungen die Datei erneut ausführen.

Entwicklung:

```bash
npm install
cp .env.example .env.local
npm test
npm run lint
npm run dev
```

Katalog-SQL neu: `npm run seed:sql`. CI auf Push/PR: `npm test` und `npm run lint`. Vercel Production führt `next build` inkl. TypeScript aus; fehlende Exporte (z. B. `getProfile`) oder `null` in `CaptionTrack[]` stoppen den Deploy. Dexie `orderBy` nur auf indizierten Feldern: `exercises.title` ist kein Index – Sortierung im Speicher, sonst `SchemaError` und die Next.js-Fehlerseite.

## 5. Phasen

### Phase A – Alltagstaugliche Web-App (da)

Katalog, Plan, Heute, Import, Beschwerden, Verlauf, optionale Cloud, Vercel-Live-Umgebung.

### Phase B – Erinnern und Offline (da)

Lokale/Web-Push-Erinnerungen zur Wunschzeit, Erinnerungs-UI im Verlauf/Profil, optionale Uhrzeit pro Plan-Eintrag, Service Worker mit Offline-Cache für App-Shell, Katalog und Übungsseiten (Dexie-Seed auch mit Cloud). YouTube/Instagram bleiben netzabhängig.

### Phase C – Handy als App (da, Store-Build folgt lokal)

PWA-Install-Hinweis und Standalone-Erkennung, Capacitor-Projekte `android/` und `ios/` im Repo, WebView gegen die gehostete URL (`i-am-super-fit.vercel.app`). Import-API bleibt auf Vercel. Store-Build mit Android Studio bzw. Xcode (macOS).

### Phase D – Vertiefen (da)

Mehr kurze Alltags- und Beschwerde-Übungen, JSON-Backup, Practice mit Pause/Wiederholung/Ende, Navigation mit Screenreader-Texten, Übernahme von lokalem Dexie-Stand ins Supabase-Konto.

Neue Arbeit wird **unten in TODO.md angehängt**. Fertiges wird dort nur abgehakt.

## 6. Risiken und Grenzen

- YouTube/Instagram liefern Metadaten, keine Videoanalyse. Vorschläge vor dem Speichern prüfen.
- Capacitor `webDir` ist `out` und nur Fallback; Store-Builds laden die gehostete Next.js-App (`server.url`), sonst fehlen API-Routen.
- Erinnerungen brauchen eine Notification-Erlaubnis und eine geöffnete oder installierte App; ohne Push-Server gibt es keine Zustellung bei komplett geschlossenem Browser.
- Cloud und lokaler Dexie-Stand bleiben getrennte Speicher; die Übernahme ins Konto liegt unter Verlauf.
- Plan-Einladungen liegen in `plan_invites`. Eine eigene Plan-Mail gibt es nicht; optional geht der bestehende Magic-Link an die Empfängeradresse. Quelle der Wahrheit ist Annehmen/Ablehnen in der App.

## 7. Dokumentation

| Datei | Zweck |
| --- | --- |
| [README.md](README.md) | Nutzung, Hosting, Entwicklung |
| [PROJEKTPLAN.md](PROJEKTPLAN.md) | Dieses Dokument |
| [TODO.md](TODO.md) | Arbeitsliste (nur abhaken, nie löschen) |
| [.cursor/rules/projektplan-todo.mdc](.cursor/rules/projektplan-todo.mdc) | Cursor-Regel (`alwaysApply`): vor der Arbeit Plan und Todo lesen, danach fortschreiben; Todo und diese Regeldatei nicht löschen/überschreiben. Optional dieselbe Kurzregel in Cursor Settings → User Rules als Backup. |

## 8. Nachtrag: Gliederpuppe

Die Practice- und Katalogansicht zeigt keine Strichmännchen-Linien mehr, sondern eine gegliederte männliche Figur (Torso, Becken, versetzte Schultern/Hüften, sichtbare Gelenke). Die Komponente heißt weiter `StickFigure`; die Posen kommen aus `poses.ts`.

## 9. Nachtrag: Originalvideo als Zusatz

Die Anleitung (Schritte + App-Figur) bleibt die Hauptansicht. Import liest öffentlich verfügbare Titel, Beschreibung und YouTube-Untertitel, wenn sie ohne API-Key erreichbar sind – keine Frame-Analyse. YouTube kann nach „Video ansehen“ über youtube-nocookie eingebettet werden (Click-to-Play). Instagram wird verlinkt („Auf Instagram öffnen“) plus Thumbnail aus og-Daten, wenn vorhanden. Andere Links öffnen im Browser.

## 10. Nachtrag: Gliederpuppe folgt der Übungsabsicht

Die Figur kopiert kein Video pixelweise. Katalog-Schritte und Import-Vorschläge nutzen authored Keyframes (`poses.ts`): Nackenkreis in vier Richtungen, Schulterheben statt Armheben, Kiefergleiten, wechselseitiges Gehen, linke/rechte Seite bei Krieger, Hüfte und Wadendehnung. Atem im Stand oder Liegen sitzt nicht mehr unpassend hin. Ohne Pose-Estimation bleiben feine Video-Details (exakte Kreisbahn, Gesichtsmuskeln, weiche Übergänge im Clip-Tempo) angenähert.

## 11. Nachtrag: Offline auf Android (PWA und Capacitor)

„App speichern“ auf Android meint die **PWA** (Zum Home-Bildschirm / Installieren) und optional die **Capacitor-Hülle**, die dieselbe Live-URL `https://i-am-super-fit.vercel.app` lädt. Beide Pfade nutzen denselben Service Worker und IndexedDB.

**Offline verfügbar:** App-Shell, Sammlung, Plan, Heute, Beschwerden, Practice-Schritte und Gliederpuppen-Posen. Der Katalog (JSON) und die Posen liegen im Bundle bzw. in Dexie; beim ersten Start (auch mit Cloud) wird der Systemkatalog lokal gesät und Cloud-Stand zusätzlich **im Hintergrund** gespiegelt. Die Oberfläche wartet nicht auf Supabase: sobald Dexie Übungen hat, erscheint die Sammlung. „Cloud-Sammlung wird vorbereitet …“ ist kein Vollbild mehr und nur ein kurzes, nicht blockierendes Banner, falls lokal noch leer ist und die Cloud wirklich lädt – mit Timeout und Fallback auf den gebündelten Katalog. Offline entfällt der Cloud-Wait.

**Nur mit Internet:** Originalvideo (YouTube youtube-nocookie, Instagram-Link, sonstige Source-URL), Import-API, Plan-Einladungen, frischer Cloud-Sync. Die Practice-Seite bleibt ohne Video nutzbar und zeigt „Video braucht Internet“.

**Datenmenge:** Katalog JSON ~33 KB, Posen ~15 KB, zusammen ~48 KB. First-Load-JS der App-Shell liegt um 226 KB. Eine YouTube-Minute liegt grob bei ≥ 8 MB. Videos werden deshalb **nicht** vorab geladen.

Capacitor: erster Kaltstart braucht Netz, um die Live-App zu laden. Danach gelten SW-Cache und Dexie wie in der installierten PWA. `webDir: out` bleibt Fallback; Store-Builds sollen weiter `server.url` auf Vercel nutzen.
