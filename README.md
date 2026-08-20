# I am fit

Tägliche Übungen, Mantras und Rituale – nicht als Fitness-Zwang, sondern als Erinnerung daran, dass du sie **machen wolltest**.

Die App läuft im Browser und lässt sich auf dem Handy als App ablegen (PWA). Dieselbe Oberfläche ist die Basis für Android- und iOS-Hüllen mit Capacitor.

## Was sie kann

- **Sammlung** mit hierarchischen Kategorien (Eltern/Kinder) und mehreren Tags pro Übung
- **Katalog + eigene Übungen**: Bewegung, Atem, Mantras, Achtsamkeit
- **Erklärung** als Text plus einheitliche Strichfigur; Schritte aneinandergereiht wirken wie ein kurzes Video
- **Import** von YouTube- oder Instagram-Links: Titel und Beschreibung werden gelesen, eine oder mehrere Übungen vorgeschlagen und als Strichfigur neu gezeichnet – das Originalvideo wird nicht übernommen
- **Übungsplan** mit Rhythmus (täglich, Wochentage, bestimmte Tage, alle n Tage) und optionalem Enddatum
- **Vorschlag**, wie lange eine Übung im Plan bleiben sollte
- **Beschwerden** wie Nacken, Rücken, Stress – dazu passende Übungen
- **Heute-Ansicht** mit Serie und sanfter Erinnerung, ohne Schuldgefühl beim Auslassen

Daten liegen lokal im Browser (IndexedDB). Es gibt kein Pflichtkonto.

## Entwicklung

```bash
npm install
npm test
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm start
```

## Aufs Handy

Im mobilen Browser: *Zum Home-Bildschirm* / *Als App installieren*. Die PWA nutzt denselben Standalone-Modus auf Android und iOS.

Für Store-Builds ist Capacitor vorbereitet (`capacitor.config.ts`, App-ID `art.schlag.iamfit`). Die Web-App sollte gehostet werden, damit der Link-Import (API-Route) erreichbar bleibt; die native Hülle zeigt dann diese URL.

## Hinweis zum Import

YouTube und Instagram liefern Metadaten, keine vollständige Videoanalyse. Die App leitet daraus Schritte und Haltungen ab und zeigt nur die eigene Figur. Prüfe Vorschläge vor dem Speichern.
