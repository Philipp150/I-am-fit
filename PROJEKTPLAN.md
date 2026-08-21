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
| **Heute** | Fällige Plan-Übungen, Serie; Erstbesuch/leerer Plan: Thema-Chips (eine Minute), dann Heute plus Erinnerungsangebot |
| **Sammlung** | Hierarchische Kategorien, Tags, Katalog und eigene Übungen |
| **Plan** | Mehrere Pläne (eigene und empfangene), Rhythmus, optionaler Zeitraum, aktiver Plan für Heute, Versand per E-Mail |
| **Themen** | Thema, Ziel oder Körperregion – Vorschläge aus dem Katalog, keine Diagnose |
| **Import** | YouTube- oder Instagram-Link → Titel/Beschreibung → Übungen als Gliederpuppe, Felder und Figur vor/nach dem Speichern bearbeitbar; gleicher Link wird erkannt; eigene Übung auch ohne Link; Bewegungsspur nur aus Datei-Upload (nicht aus der Einbettung) |
| **Verlauf** | 28-Tage-Raster, letzte Completions, Anzeigename |
| **Konto** | Optionale E-Mail-Anmeldung über Supabase; ohne Login nur lokaler Speicher |

Katalogstand (Systemdaten): 18 Kategorien, 11 Themen (Körperregion/Ziel/Alltag, IDs weiter `complaints`), 32 Übungen (Bewegung, Atem, Mantra, Achtsamkeit, Alltag).

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
| UI | `src/app/*`, `src/components/*` (PosePlayer + Gliederpuppe in `StickFigure.tsx`, Originalvideo in `SourceVideo.tsx`, Bewegungsspur in `PoseTrackCapture.tsx`), Bottom-Nav |
| Domain | `src/lib/plan.ts`, `plan-share.ts`, `schedule.ts`, `catalog.ts`, `suggestions.ts`, `onboarding.ts`, `poses.ts`, `pose-track.ts` |
| Persistenz | `src/lib/repository.ts` schaltet zwischen Dexie und Supabase |
| Cloud | `supabase/setup.sql` (Schema inkl. `plans` / `plan_invites` / `exercises.pose_track`, RLS, Seed), `@supabase/ssr`; Tabellen existieren im Live-Projekt |
| Import | `src/app/api/import/route.ts` + `extract-meta.ts` / `import-parse.ts`; Client-Analyse mit MediaPipe Pose (WASM) und Tesseract.js-OCR nur wenn Pixel da sind (Upload oder öffentliche Videodatei) |
| PWA | `src/app/manifest.ts`, Raster-Icons 192/512, `public/sw.js` (Offline-Cache für App-Shell, Katalogseiten, Pose-JS; YouTube/Instagram bewusst **nicht**) |
| Native Hülle | Capacitor 7 (`capacitor.config.ts`, App-ID `art.schlag.iamfit`); `android/` und `ios/` laden `https://i-am-super-fit.vercel.app`, damit Import-API und Auth erreichbar bleiben. |

Datenmodell (Kern): `Category`, `Complaint`, `Exercise` (Schritte + Pose-IDs, optional kompakte `poseTrack`-Zeitreihe), `TrainingPlan` (mehrere Pläne pro Person, mit Urheber), `PlanItem` (gehört zu einem Plan), `PlanInvite` (Einladung per E-Mail), `Completion`, `Profile` (`activePlanId`). Erinnerungen (`reminderEnabled`, `reminderTime`, optional `PlanItem.reminderTime`) werden in Verlauf/Plan gesetzt und lösen lokale bzw. Web-Push-Notifications aus, solange die App oder die installierte PWA erreichbar ist.

Pläne können von einer anderen Person (z. B. Physiotherapie) zusammengestellt und an eine E-Mail geschickt werden. Die empfangende Person nimmt die Einladung in der App an; der bisherige Plan bleibt. Teilen braucht Cloud/Auth (Supabase). Ohne Cloud bleiben mehrere eigene Pläne lokal nutzbar.

## 4. Betrieb

| Dienst | Rolle |
| --- | --- |
| **Vercel** (Projekt `i-am-super-fit`, Hobby) | Next.js-Hosting, Import-API, Deploy bei Push auf `main` |
| **Supabase** (Free) | Postgres, RLS, Magic-Link/E-Mail-Auth |

Ohne Vercel nur lokal mit Node. Ohne Supabase nur dieser eine Browser.

Setup-Kurzfassung: `supabase/setup.sql` im SQL-Editor ausführen; Site-URL und Redirect `/auth/callback` setzen; in Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. Keine Secrets ins Repo oder in Cursor-Regeln. Das Live-Projekt hat `plans`, `plan_invites` und `exercises.pose_track`; nach weiteren Schema-Änderungen die Datei erneut ausführen.

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

Katalog, Plan, Heute, Import, Themen, Verlauf, optionale Cloud, Vercel-Live-Umgebung.

### Phase B – Erinnern und Offline (da)

Lokale/Web-Push-Erinnerungen zur Wunschzeit, Erinnerungs-UI im Verlauf/Profil, optionale Uhrzeit pro Plan-Eintrag, Service Worker mit Offline-Cache für App-Shell, Katalog und Übungsseiten (Dexie-Seed auch mit Cloud). YouTube/Instagram bleiben netzabhängig.

### Phase C – Handy als App (da, Store-Build folgt lokal)

PWA-Install-Hinweis und Standalone-Erkennung, Capacitor-Projekte `android/` und `ios/` im Repo, WebView gegen die gehostete URL (`i-am-super-fit.vercel.app`). Import-API bleibt auf Vercel. Store-Build mit Android Studio bzw. Xcode (macOS).

### Phase D – Vertiefen (da)

Mehr kurze Alltags- und Themen-Übungen, JSON-Backup, Practice mit Pause/Wiederholung/Ende, Navigation mit Screenreader-Texten, Übernahme von lokalem Dexie-Stand ins Supabase-Konto.

Neue Arbeit wird **unten in TODO.md angehängt**. Fertiges wird dort nur abgehakt.

## 6. Risiken und Grenzen

- YouTube/Instagram liefern Metadaten, keine Pixel in der iframe-Einbettung. Es gibt keinen YouTube-Downloader. Ohne hochgeladene Datei bleibt der PoseId-Fallback; eingeblendeter Text wird nicht gelesen. Die App sagt das klar. Vorschläge vor dem Speichern prüfen und anpassen (Titel, Schritte, Figur). Derselbe Link öffnet den vorhandenen Eintrag statt einer stillen Kopie. Eigene Übungen gehen auch ohne Link.
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

Die Anleitung (Schritte + App-Figur) bleibt die Hauptansicht. Import liest öffentlich verfügbare Titel, Beschreibung und YouTube-Untertitel, wenn sie ohne API-Key erreichbar sind. Die iframe-Einbettung hat keine Pixel für Pose-Estimation – siehe Nachtrag 13. YouTube kann nach „Video ansehen“ über youtube-nocookie eingebettet werden (Click-to-Play). Instagram wird verlinkt („Auf Instagram öffnen“) plus Thumbnail aus og-Daten, wenn vorhanden. Andere Links öffnen im Browser.

## 10. Nachtrag: Gliederpuppe folgt der Übungsabsicht

Die Figur kopiert kein Video pixelweise als Slideshow. Katalog-Schritte und Import-Vorschläge ohne Clip nutzen authored Keyframes (`poses.ts`): Nackenkreis in vier Richtungen, Schulterheben statt Armheben, Kiefergleiten, wechselseitiges Gehen, linke/rechte Seite bei Krieger, Hüfte und Wadendehnung. Atem im Stand oder Liegen sitzt nicht mehr unpassend hin. Liegt eine Bewegungsspur vor, folgt die Figur dieser Zeitreihe (Nachtrag 13); sonst bleiben feine Video-Details an den authored Posen angenähert.

## 11. Nachtrag: Offline auf Android (PWA und Capacitor)

„App speichern“ auf Android meint die **PWA** (Zum Home-Bildschirm / Installieren) und optional die **Capacitor-Hülle**, die dieselbe Live-URL `https://i-am-super-fit.vercel.app` lädt. Beide Pfade nutzen denselben Service Worker und IndexedDB.

**Offline verfügbar:** App-Shell, Sammlung, Plan, Heute, Themen, Practice-Schritte und Gliederpuppen-Posen. Der Katalog (JSON) und die Posen liegen im Bundle bzw. in Dexie; beim ersten Start (auch mit Cloud) wird der Systemkatalog lokal gesät und Cloud-Stand zusätzlich **im Hintergrund** gespiegelt. Die Oberfläche wartet nicht auf Supabase: sobald Dexie Übungen hat, erscheint die Sammlung. „Cloud-Sammlung wird vorbereitet …“ ist kein Vollbild mehr und nur ein kurzes, nicht blockierendes Banner, falls lokal noch leer ist und die Cloud wirklich lädt – mit Timeout und Fallback auf den gebündelten Katalog. Offline entfällt der Cloud-Wait.

**Nur mit Internet:** Originalvideo (YouTube youtube-nocookie, Instagram-Link, sonstige Source-URL), Import-API, Plan-Einladungen, frischer Cloud-Sync, erstes Laden des MediaPipe-Modells zur Analyse. Die Practice-Seite bleibt ohne Video nutzbar und zeigt „Video braucht Internet“. Eine bereits gespeicherte Bewegungsspur spielt offline.

**Datenmenge:** Katalog JSON ~33 KB, Posen ~15 KB, zusammen ~48 KB. First-Load-JS der App-Shell liegt um 226 KB. Eine Bewegungsspur liegt im KB- bis niedrigen Hunderte-KB-Bereich. Eine YouTube-Minute liegt grob bei ≥ 8 MB. Videos werden deshalb **nicht** vorab geladen.

## 12. Nachtrag: Import bearbeiten, Duplikate, ohne Link

Nach dem Ableiten eines Links ist der Vorschlag ein Formular, keine tote Karte: Titel, Kurztext, Schritte, Dauer, Kategorien, Themen und die Figur (Pose je Schritt, PosePlayer-Vorschau, optional Bewegungsspur) lassen sich vor dem Speichern ändern. Dieselbe Bearbeitung steht danach unter „Felder und Figur anpassen“ (`/catalog/[id]/edit`). YouTube bleibt Click-to-Play, Instagram outbound.

Derselbe Link (normalisiert, z. B. youtu.be und watch?v=) wird in der lokalen bzw. Cloud-Sammlung erkannt – eigene Übungen und Katalog-Einträge mit Source-URL. Die App zeigt „Dieser Link ist schon in der Sammlung“, öffnet den vorhandenen Eintrag zum Anpassen und legt keine stille zweite Kopie an.

Ohne Link: Sammlung „Selbst anlegen“ und auf der Import-Seite „Ohne Link anlegen“. Eigene Übungen sind `is_system` false und haben keine Source-URL.

## 13. Nachtrag: Bewegungsspur statt Standbild-Katalog

Beim Import oder „Selbst anlegen“ kann ein **Videoclip einmal** im Browser analysiert werden (MediaPipe Pose / BlazePose, WASM, ca. 8–12 fps). Ergebnis ist eine kompakte Gelenk-Zeitreihe (`Exercise.poseTrack`, Dexie + Supabase `jsonb`), die der vorhandenen Gliederpuppe zugeordnet wird. PosePlayer spielt die Spur (Loop/Sync zur Dauer); ohne Spur bleiben die authored PoseIds. Schritte bleiben bearbeitbar; neu erkennen ersetzt die Spur.

**Pixelquellen:** Hochgeladene Datei ist der zuverlässige Weg. YouTube/Instagram-iframes haben keine Pixel – kein yt-dlp, keine stille Analyse der Einbettung. Nur wenn schon eine öffentliche Videodatei-URL (mp4/webm/mov) vorliegt, darf der Client sie lesen. Sonst Hinweis: Datei oder kurzen Clip hochladen.

Analyse-UX: „Bewegung wird erkannt …“ und „Text im Video wird gelesen …“; Fehler, wenn keine Person gefunden wird. Fehlender Overlay-Text ist kein Fehler. Playback-Hinweis „Video braucht Internet“ bleibt für Originalclips.

## 14. Nachtrag: Text im Video (OCR + Untertitel)

Beim Datei-Upload läuft OCR (Tesseract.js, WASM) im selben Durchgang wie die Bewegungsspur, etwas sparsamer als die Pose-Abtastung. Gelesen werden Einblendungen (Titel, „Schritt n“, Übungsnamen, Dauer, links/rechts). Vorhandene YouTube-Untertitel und Beschreibungen werden **dazugemerkt**, nicht verworfen. Klare Schrittgrenzen (Schritt-Marker, nummerierte Listen, neuer Overlay-Titel) teilen `steps[]` und setzen `startSec`, damit PosePlayer den neuen Schritt zur passenden Zeit zeigt. Unklarer Rauschen erzeugt keine Extra-Schritte. Ohne Datei bleiben Captions/Metadaten wie bisher; OCR braucht Pixel – derselbe Hinweis wie bei der Bewegungsspur. Es werden keine Frame-Bilder gespeichert. Der Service Worker cached YouTube weiterhin nicht.

## 15. Nachtrag: Themen statt Diagnose, Erststart Thema → Heute

Die Oberfläche sagt **Thema**, **Ziel** oder **Körperregion**, nicht Beschwerde. Menschen wollen oft Bauch oder Büro, keine Diagnose. Chips unter „Worum soll’s gehen?“: Nacken, Rücken, Bauch, Beweglichkeit, Büro. Die Tabelle heißt weiter `complaints`, die IDs (`comp-neck`, …) bleiben.

Erstbesuch und leerer Plan: ein Thema, eine Minute (`durationSec` 60), Landung auf **Heute**. Dexie zuerst; bestehende und empfangene Pläne bleiben. Optional Erinnerung danach. Nav-Punkt **Themen**, Sammlung filtert nach Thema, Editor „Thema, Ziel, Körperregion“.
