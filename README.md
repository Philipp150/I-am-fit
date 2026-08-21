# I am fit

Tägliche Übungen, Mantras und Rituale – nicht als Fitness-Zwang, sondern als Erinnerung daran, dass du sie **machen wolltest**.

Die App läuft im Browser und lässt sich auf dem Handy als App ablegen (PWA). Dieselbe Oberfläche ist die Basis für Android- und iOS-Hüllen mit Capacitor.

## Vercel und Supabase – wer macht was?

| Dienst | Rolle |
| --- | --- |
| **Vercel** | Hostet die Next.js-App. Du öffnest eine URL auf dem PC oder Handy, ohne `npm run`. Die Import-API (YouTube/Instagram) läuft dort mit. |
| **Supabase** | Datenbank + Anmeldung. Katalog, eigene Übungen, Plan und Verlauf liegen in der Cloud – PC und Handy sehen denselben Stand. |

Ohne Vercel bleibt die App nur lokal auf einem Rechner mit Node. Ohne Supabase speichert sie nur in **diesem einen Browser** (IndexedDB). Für den Alltag auf PC **und** Handy braucht es beides.

Die kostenlosen Pläne (Vercel Hobby, Supabase Free) reichen für den Start.

## Was die App kann

- **Sammlung** mit hierarchischen Kategorien (Eltern/Kinder) und mehreren Tags pro Übung
- **Katalog + eigene Übungen**: Bewegung, Atem, Mantras, Achtsamkeit
- **Erklärung** als Text plus einheitliche Gliederpuppe (männlich, mit Gelenken); Schritte aneinandergereiht wirken wie ein kurzes Video
- **Import** von YouTube- oder Instagram-Links: Titel und Beschreibung werden gelesen, eine oder mehrere Übungen vorgeschlagen und als Gliederpuppe neu gezeichnet
- **Übungsplan** mit Rhythmus und optionalem Zeitraum; mehrere Pläne, Versand an eine E-Mail (Annehmen in der App)
- **Beschwerden** mit passenden Übungsvorschlägen
- **Heute-Ansicht** mit Serie, ohne Schuldgefühl beim Auslassen
- **Originalvideo (zusätzlich)**: YouTube nach Tipp auf „Video ansehen“ (youtube-nocookie); Instagram als Link plus Thumbnail, wenn vorhanden. Die Anleitung mit Schritten und App-Figur bleibt die Hauptansicht.

## Hosting (ohne lokales npm)

Live: [i-am-super-fit.vercel.app](https://i-am-super-fit.vercel.app/)  
Quellcode: [github.com/Philipp150/I-am-fit](https://github.com/Philipp150/I-am-fit)

Vercel-Projektname **i-am-super-fit**, weil `i-am-fit` schon vergeben war. Pushes nach `main` auf GitHub gehen dort live.

### Supabase (Geräte-Sync)

1. Neues Projekt auf [supabase.com](https://supabase.com) anlegen.
2. SQL-Editor öffnen und `supabase/setup.sql` vollständig ausführen (Schema + Katalog). Nach Schema-Änderungen (z. B. mehrere Pläne / Einladungen) die Datei erneut ausführen.
3. Unter **Authentication → URL configuration**:
   - Site URL = `https://i-am-super-fit.vercel.app`
   - Redirect URLs: `https://i-am-super-fit.vercel.app/auth/callback`
4. Unter **Project Settings → API** merken: Project URL und `anon` / publishable key.
5. In Vercel als Environment Variables setzen:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://i-am-super-fit.vercel.app
```

Ohne diese Variablen startet die App trotzdem – dann nur mit lokalem Browser-Speicher.

## Projektplan

Stand, Phasen und offene Arbeit: [PROJEKTPLAN.md](PROJEKTPLAN.md), [TODO.md](TODO.md). In der Todo-Liste werden Punkte nur abgehakt, nicht gelöscht. Agents lesen beides über die Git-Regel `.cursor/rules/projektplan-todo.mdc`.

## Entwicklung

```bash
npm install
cp .env.example .env.local
npm test
npm run lint
npm run dev
```

Katalog-SQL neu erzeugen: `npm run seed:sql` (danach `schema.sql` und `seed.sql` zu `setup.sql` zusammenfügen). Raster-Icons: `npm run icons`.

CI (GitHub Actions auf Push und Pull Request) führt `npm test` und `npm run lint` aus.

## Aufs Handy

Im mobilen Browser: *Zum Home-Bildschirm* / *Als App installieren*. Die App zeigt einen Hinweis, wenn der Browser das anbietet, und erkennt die Standalone-Darstellung. Nach dem Login über Vercel+Supabase ist der Plan derselbe wie am PC.

Erinnerungen (Uhrzeit unter Verlauf, optional pro Plan-Eintrag) brauchen eine Notification-Erlaubnis. Sie feuern lokal bzw. über den Service Worker, solange die App oder die installierte PWA erreichbar ist.

Offline: der Service Worker hält App-Shell und Katalog. Die Import-API braucht Netz.

### Capacitor (Android / iOS)

Die Hüllen liegen in `android/` und `ios/` und laden die Live-App, nicht den lokalen `out/`-Export. Dadurch bleiben `/api/import` und Auth auf Vercel.

```bash
npm run cap:sync
```

Android: Projekt in Android Studio öffnen. iOS: `ios/App` in Xcode öffnen (macOS, CocoaPods: `cd ios/App && pod install`).

| Store-Feld | Wert |
| --- | --- |
| App-ID / Bundle-ID | `art.schlag.iamfit` |
| Anzeigename | I am fit |
| Live-URL | https://i-am-super-fit.vercel.app |
| PWA-Icons | `public/icon-192.png`, `public/icon-512.png` (plus SVG) |
| Store-Icon | 1024×1024 aus derselben Figur, in Xcode/Play Console |

## Backup und Konto-Wechsel

Unter **Verlauf** gibt es ein JSON-Backup von eigenen Übungen, Plan und Verlauf. Katalog-Übungen stehen nicht in der Datei.

Wenn du zuerst lokal geübt hast und dich später anmeldest, kannst du den Dexie-Stand dort ins Supabase-Konto kopieren.

## Hinweis zum Import

YouTube und Instagram liefern Metadaten, keine vollständige Videoanalyse. Die App zeigt nur die eigene Figur. Prüfe Vorschläge vor dem Speichern.

## Originalvideo und „Mitlesen“ beim Import

Import liest weiterhin nur öffentlich verfügbare Texte: oEmbed (Titel, Kanal, Thumbnail), HTML-Meta und – bei YouTube – Beschreibung sowie Untertitel/Timedtext, wenn die öffentliche Seite sie hergibt. Keine API-Keys, keine Frame-Analyse, keine Behauptung, die App hätte das Video „gesehen“.

Die **Anleitung** (Schritte + App-Figur / PosePlayer) bleibt die Hauptansicht („Zur Anleitung“). Das **Originalvideo** ist ein kompakter Zusatzplayer („Originalvideo (zusätzlich)“), Click-to-Play, damit YouTube nicht ungefragt Cookies setzt. Instagram wird nicht zuverlässig eingebettet; dort gibt es „Auf Instagram öffnen“ und optional das og-Thumbnail. Andere Web-Links öffnen im Browser.
