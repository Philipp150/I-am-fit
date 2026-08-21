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

Katalogstand (Systemdaten): 18 Kategorien, 8 Beschwerden, 24 Übungen (Bewegung, Atem, Mantra, Achtsamkeit, Alltag).

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
| PWA | `src/app/manifest.ts`, `public/sw.js` (derzeit Durchleitung ohne Cache) |
| Native Hülle | Capacitor 7 (`capacitor.config.ts`, App-ID `art.schlag.iamfit`); `android/` und `ios/` sind noch nicht im Repo |

Datenmodell (Kern): `Category`, `Complaint`, `Exercise` (Schritte + Pose-IDs), `PlanItem`, `Completion`, `Profile`. Erinnerungsfelder (`reminderEnabled`, `reminderTime`) existieren im Modell, werden in der UI noch nicht gesetzt und lösen keine Notifications aus.

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

Katalog-SQL neu: `npm run seed:sql`.

## 5. Phasen

### Phase A – Alltagstaugliche Web-App (weitgehend da)

Katalog, Plan, Heute, Import, Beschwerden, Verlauf, optionale Cloud, Vercel-Live-Umgebung.

### Phase B – Erinnern und Offline

Lokale/Web-Push-Erinnerungen zur Wunschzeit, Erinnerungs-UI im Verlauf/Profil, Service Worker mit sinnvollem Offline-Cache, rasterbasierte Install-Icons.

### Phase C – Handy als App

PWA-Install härten, Capacitor-Projekte für Android und iOS erzeugen, Store-Builds gegen die gehostete URL (Import-API bleibt auf Vercel).

### Phase D – Vertiefen

Mehr Katalog und Beschwerden, Export/Backup, Tests über die Lib-Grenzen hinaus, Barrierefreiheit und Feinschliff der Practice-Ansicht.

Neue Arbeit wird **unten in TODO.md angehängt**. Fertiges wird dort nur abgehakt.

## 6. Risiken und Grenzen

- YouTube/Instagram liefern Metadaten, keine Videoanalyse. Vorschläge vor dem Speichern prüfen.
- Capacitor `webDir` ist `out`; Store-Builds sollen die gehostete Next.js-App ansprechen, sonst fehlen API-Routen.
- Erinnerungsfelder ohne Notification-Pfad erzeugen keine echten Erinnerungen.
- Cloud und lokaler Dexie-Stand sind getrennte Welten; ein späterer Migrationspfad ist offen.

## 7. Dokumentation

| Datei | Zweck |
| --- | --- |
| [README.md](README.md) | Nutzung, Hosting, Entwicklung |
| [PROJEKTPLAN.md](PROJEKTPLAN.md) | Dieses Dokument |
| [TODO.md](TODO.md) | Arbeitsliste (nur abhaken, nie löschen) |
