# Projektplan – I am fit

Lebendes Dokument für Vision, Architektur und Phasen. Offene und erledigte Arbeit steht in [TODO.md](TODO.md). Erledigte Todo-Punkte bleiben dort abgehakt und werden nicht gelöscht.

## 1. Produkt

**I am fit** ist eine tägliche Übungs-App für Bewegung, Atem, Mantras und Rituale. Sie erinnert daran, dass man die Übungen *selbst* machen wollte – ohne Fitness-Zwang und ohne Schuldgefühl beim Auslassen.

Live: [i-am-super-fit.vercel.app](https://i-am-super-fit.vercel.app/)  
Quellcode: dieses Repository (`schlag-art/philipp150-I-am-fit`, Ursprung [github.com/Philipp150/I-am-fit](https://github.com/Philipp150/I-am-fit))

### Prinzipien

- Sanfte Erinnerung statt Druck: Serie und Verlauf sind Blick zurück, kein Score.
- Einheitliche Strichfigur statt fremder Videos; Import liefert Metadaten, die Figur zeichnet die App neu.
- Derselbe Plan auf PC und Handy, sobald Vercel + Supabase laufen.
- Ohne Cloud bleibt die App lokal im Browser (IndexedDB) nutzbar.

## 2. Was die App kann

| Bereich | Inhalt |
| --- | --- |
| **Heute** | Fällige Plan-Übungen, Serie, Einstieg mit drei Ankern |
| **Sammlung** | Hierarchische Kategorien, Tags, Katalog und eigene Übungen |
| **Plan** | Rhythmus (täglich, Wochentage, Wochenende, bestimmte Tage, alle *n* Tage), optionaler Zeitraum |
| **Beschwerden** | Symptom-Auswahl mit Vorschlägen aus dem Katalog |
| **Import** | YouTube- oder Instagram-Link → Titel/Beschreibung → eine oder mehrere Übungen als Strichfigur |
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
| UI | `src/app/*`, `src/components/*`, Bottom-Nav (Heute, Sammlung, Plan, Beschwerden) |
| Domain | `src/lib/plan.ts`, `schedule.ts`, `catalog.ts`, `suggestions.ts`, `poses.ts` |
| Persistenz | `src/lib/repository.ts` schaltet zwischen Dexie und Supabase |
| Cloud | `supabase/setup.sql` (Schema, RLS, Seed), `@supabase/ssr` |
| Import | `src/app/api/import/route.ts` + `extract-meta.ts` / `import-parse.ts` |
| PWA | `src/app/manifest.ts`, Raster-Icons 192/512, `public/sw.js` (Offline-Cache für App-Shell und Katalog) |
| Native Hülle | Capacitor 7 (`capacitor.config.ts`, App-ID `art.schlag.iamfit`); `android/` und `ios/` laden `https://i-am-super-fit.vercel.app`, damit Import-API und Auth erreichbar bleiben. |

Datenmodell (Kern): `Category`, `Complaint`, `Exercise` (Schritte + Pose-IDs), `PlanItem`, `Completion`, `Profile`. Erinnerungen (`reminderEnabled`, `reminderTime`, optional `PlanItem.reminderTime`) werden in Verlauf/Plan gesetzt und lösen lokale bzw. Web-Push-Notifications aus, solange die App oder die installierte PWA erreichbar ist.

## 4. Betrieb

| Dienst | Rolle |
| --- | --- |
| **Vercel** (Projekt `i-am-super-fit`, Hobby) | Next.js-Hosting, Import-API, Deploy bei Push auf `main` |
| **Supabase** (Free) | Postgres, RLS, Magic-Link/E-Mail-Auth |

Ohne Vercel nur lokal mit Node. Ohne Supabase nur dieser eine Browser.

Setup-Kurzfassung: `supabase/setup.sql` im SQL-Editor ausführen; Site-URL und Redirect `/auth/callback` setzen; in Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.

Entwicklung:

```bash
npm install
cp .env.example .env.local
npm test
npm run lint
npm run dev
```

Katalog-SQL neu: `npm run seed:sql`. CI auf Push/PR: `npm test` und `npm run lint`.

## 5. Phasen

### Phase A – Alltagstaugliche Web-App (da)

Katalog, Plan, Heute, Import, Beschwerden, Verlauf, optionale Cloud, Vercel-Live-Umgebung.

### Phase B – Erinnern und Offline (da)

Lokale/Web-Push-Erinnerungen zur Wunschzeit, Erinnerungs-UI im Verlauf/Profil, optionale Uhrzeit pro Plan-Eintrag, Service Worker mit Offline-Cache für App-Shell und Katalog, rasterbasierte Install-Icons.

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

## 7. Dokumentation

| Datei | Zweck |
| --- | --- |
| [README.md](README.md) | Nutzung, Hosting, Entwicklung |
| [PROJEKTPLAN.md](PROJEKTPLAN.md) | Dieses Dokument |
| [TODO.md](TODO.md) | Arbeitsliste (nur abhaken, nie löschen) |
