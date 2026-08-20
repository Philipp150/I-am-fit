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
- **Erklärung** als Text plus einheitliche Strichfigur; Schritte aneinandergereiht wirken wie ein kurzes Video
- **Import** von YouTube- oder Instagram-Links: Titel und Beschreibung werden gelesen, eine oder mehrere Übungen vorgeschlagen und als Strichfigur neu gezeichnet
- **Übungsplan** mit Rhythmus und optionalem Zeitraum
- **Beschwerden** mit passenden Übungsvorschlägen
- **Heute-Ansicht** mit Serie, ohne Schuldgefühl beim Auslassen

## Hosting (ohne lokales npm)

Live: [i-am-super-fit.vercel.app](https://i-am-super-fit.vercel.app/)  
Quellcode: [github.com/Philipp150/I-am-fit](https://github.com/Philipp150/I-am-fit)

Vercel-Projektname **i-am-super-fit**, weil `i-am-fit` schon vergeben war. Pushes nach `main` auf GitHub gehen dort live.

### Supabase (Geräte-Sync)

1. Neues Projekt auf [supabase.com](https://supabase.com) anlegen.
2. SQL-Editor öffnen und `supabase/setup.sql` vollständig ausführen (Schema + Katalog).
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

## Entwicklung

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

Katalog-SQL neu erzeugen: `npm run seed:sql` (danach `schema.sql` und `seed.sql` zu `setup.sql` zusammenfügen).

## Aufs Handy

Im mobilen Browser: *Zum Home-Bildschirm* / *Als App installieren*. Nach dem Login über Vercel+Supabase ist der Plan derselbe wie am PC.

## Hinweis zum Import

YouTube und Instagram liefern Metadaten, keine vollständige Videoanalyse. Die App zeigt nur die eigene Figur. Prüfe Vorschläge vor dem Speichern.
