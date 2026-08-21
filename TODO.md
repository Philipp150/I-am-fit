# Todo – I am fit

Arbeitsliste zum [Projektplan](PROJEKTPLAN.md).

## Regel

**Punkte werden nur abgehakt, niemals gelöscht.** Erledigtes bleibt als `[x]` stehen, damit der Verlauf sichtbar bleibt. Neue Aufgaben kommen **unten in der passenden Sektion** dazu, bestehende Zeilen werden nicht entfernt und nicht umgeschrieben, außer um sie abzuhaken oder eine sachliche Korrektur am Wortlaut vorzunehmen.

Format: `- [ ]` offen, `- [x]` erledigt.

---

## Produktkern

- [x] Next.js-App mit Heute-, Sammlungs-, Plan-, Beschwerden- und Verlaufsansicht
- [x] Practice-Ansicht mit einheitlicher Strichfigur und Schrittfolge
- [x] Übungskatalog (Bewegung, Atem, Mantra, Achtsamkeit, Alltag)
- [x] Hierarchische Kategorien und mehrere Kategorien pro Übung
- [x] Eigene Übung anlegen
- [x] Übungsplan mit Rhythmus und optionalem Zeitraum
- [x] Heute-Ansicht mit fälligen Übungen und Serie ohne Schuldgefühl
- [x] Beschwerden mit Übungsvorschlägen
- [x] Verlauf (28-Tage-Raster, letzte Completions, Anzeigename)
- [x] Import von YouTube- oder Instagram-Links zu Übungsvorschlägen
- [x] Import zeichnet nur die eigene Figur, kein Originalvideo in der App
- [x] Lokaler Speicher im Browser (IndexedDB / Dexie)
- [x] Optionaler Cloud-Sync über Supabase (Katalog, Plan, Verlauf, Auth)
- [x] E-Mail-Anmeldung und Auth-Callback
- [x] Fallback ohne Cloud: App bleibt lokal nutzbar
- [x] PWA-Grundlage (Manifest, Theme, „Zum Home-Bildschirm“)
- [x] Capacitor-Konfiguration als Basis für Android- und iOS-Hüllen
- [x] Hosting auf Vercel (`i-am-super-fit.vercel.app`)
- [x] README zu Nutzung, Vercel und Supabase
- [x] Projektplan-Datei anlegen
- [x] Todo-Liste anlegen (Punkte nur abhaken, nicht löschen)
- [x] Mehrere benannte Übungspläne (eigene und empfangene), einer davon aktiv für Heute
- [x] Urheber sichtbar (Name/E-Mail der Person, die den Plan erstellt oder geschickt hat)
- [x] Plan per E-Mail einladen: Inbox in der App, Annehmen als Kopie, Ablehnen; ohne Cloud klarer Hinweis
- [x] Practice-Figur: gegliederte männliche Gliederpuppe (Torso, Gelenke) statt reiner Strichfigur
- [x] Live-Supabase: Tabellen `plans` und `plan_invites` existieren (setup.sql auf dem Projekt ausgeführt; keine Secrets im Repo)

## Qualität und Betrieb

- [x] Unit-Tests für Katalog, Zeitplan, Mapper, Import, Vorschläge, Kategorien, Seed-SQL
- [x] SQL-Seed aus dem Katalog erzeugen (`npm run seed:sql`)
- [x] RLS-Policies für eigene Daten in Supabase
- [x] `npm test` und `npm run lint` in der CI bzw. vor jedem Merge grün halten
- [x] Tests für Plan-Logik, Repository-Schalter (lokal/Cloud) und kritische UI-Pfade
- [x] Fehlerfälle beim Import klarer machen (ungültiger Link, fehlende Metadaten)
- [x] Tests für Plan-Einladung annehmen (Snapshot, Attribution, keine anderen Pläne überschreiben)

## Erinnerungen und Offline (Phase B)

- [x] Erinnerungszeit und -schalter in der UI (Profil/Verlauf) setzen können
- [x] Lokale oder Web-Push-Erinnerung zur Wunschzeit
- [x] Optional erinnern pro Plan-Eintrag (`PlanItem.reminderTime`)
- [x] Service Worker: Offline-Cache für App-Shell und Katalog statt reiner Durchleitung
- [x] Raster-Icons für die Installation (neben SVG)
- [x] Service Worker in der App registrieren, wenn der Cache steht

## Handy als App (Phase C)

- [x] PWA-Install-Hinweis und Standalone-Darstellung prüfen
- [x] Capacitor-Projekt Android erzeugen und gegen die Live-URL betreiben
- [x] Capacitor-Projekt iOS erzeugen und gegen die Live-URL betreiben
- [x] Import-API in Native-Builds über das gehostete Backend erreichbar halten
- [x] Store-Assets und App-IDs dokumentieren

## Vertiefen (Phase D)

- [x] Katalog um weitere kurze Alltags- und Beschwerde-Übungen erweitern
- [x] Export oder Backup von Plan und eigenen Übungen
- [x] Practice-Ansicht: Pause, Wiederholung, klare Beendigung
- [x] Barrierefreiheit (Kontrast, Fokus, Screenreader-Texte an der Navigation)
- [x] Migrationspfad zwischen lokalem Dexie-Stand und Supabase-Konto

## Dokumentation

- [x] Hosting-Unterschied Vercel vs. Supabase beschreiben
- [x] Hinweis: Import ist Metadaten, keine Videoanalyse
- [x] Projektplan nach größeren Phasen aktualisieren (nur ergänzen, Todo nicht leeren)
- [x] Cursor-Regel `.cursor/rules/projektplan-todo.mdc` (`alwaysApply`): Plan und Todo vor der Arbeit lesen, danach fortschreiben; `TODO.md` nie löschen; diese Regeldatei nicht neu erzeugen oder überschreiben

## Betrieb (Vercel)

- [x] Production-Build: TypeScript-Fehler in `extractYoutubeCaptionTracks` (`map` + `null` nicht als `CaptionTrack[]`) beheben, damit Vercel `i-am-super-fit` wieder deployt
- [x] Preview-Build SHA `5cb5bd2` (`dpl_AZfzZPe7iLsTec2LffMoXfwbuXAs`): `getProfile` war in `addCompletion` gerutscht (kein Export, doppelte `user`/`error`, Return `Profile` vs `void`). Eigene Funktion bleibt; Regressionstest. CaptionTrack-`null` nicht wieder eingeführt.

## Originalvideo und Import-Qualität

- [x] Originalvideo zusätzlich in Practice und Katalog zeigen (Anleitung/PosePlayer bleibt primär)
- [x] YouTube: youtube-nocookie-Embed erst nach Tipp auf „Video ansehen“
- [x] Instagram: „Auf Instagram öffnen“ plus Thumbnail aus og-Daten, kein privates-API-Scraping
- [x] Import liest oEmbed, HTML-Meta und öffentliche YouTube-Untertitel/Beschreibung für bessere Schritte
- [x] Unit-Tests für YouTube-URL → Embed-ID; Import-Parse bleibt grün
- [x] UI ehrlich: öffentlich verfügbare Texte, danach unsere Figur; Original nur zusätzlich

## Gliederpuppe und Video-Absicht (ohne Pose-Estimation)

- [x] Katalog-Posen an die Übungsabsicht anpassen: Nackenkreis (vorn/seit/hinten), Schulterkreis (vorn-hoch-hinten-unten), Kiefer links/rechts, Gehen mit wechselseitigem Schritt, Laterality bei Krieger/Hüfte/Wade
- [x] Stehen/Liegen/Sitzen nicht mehr vertauschen (Bildschirmpause atmet im Stand; 4-7-8 und Bodyscan bleiben liegen)
- [x] Import-Targeting: Titel und Schritttext steuern die Pose; „Schritt 1“ ist kein Gehen; „Schultern nicht hochziehen“ ist kein Shrug
- [x] PosePlayer bleibt primär; YouTube bleibt Click-to-Play und treibt die Figur nicht
- [x] Tests für Posen, Katalog-Schritte und Import-Zuordnung; CaptionTrack-`null`-Bug nicht wieder eingeführt

## Android-Offline (Katalog ohne Videos)

- [x] Service Worker: App-Shell plus alle Katalog-Übungsseiten precachen; YouTube/Instagram/googlevideo/blob-Video nicht cachen
- [x] Dexie-Katalog auch bei aktivem Supabase säen und Cloud-Stand lokal spiegeln, damit Heute/Sammlung/Practice ohne Netz öffnen
- [x] PWA-Install und Capacitor-WebView (Live-URL) nutzen denselben Offline-Pfad
- [x] Originalvideo offline: Übung bleibt mit Figur/Schritten; Hinweis „Video braucht Internet“
- [x] Größenvergleich: Katalog+Posen ≪ YouTube-Minute, daher keine Video-Precache
- [x] Tests für SW-Policy, Precache-Pfade, Dexie-Fallback und `npm run build`
