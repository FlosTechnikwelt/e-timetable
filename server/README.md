# Untis Stundenplan Anzeige - Anleitung

## Übersicht
Diese Anwendung zeigt einen Untis-Stundenplan an und wechselt automatisch zwischen dem Stundenplan und aktuellen Arbeiten. Die Anwendung berücksichtigt Wochenenden, Ferien und Feiertage und zeigt für diese Tage den nächsten Schultag an. Stundenausfälle und Änderungen werden farblich hervorgehoben.

## Funktionen

- **Automatischer Wechsel**: Die Anzeige wechselt alle 30 Sekunden zwischen Stundenplan und aktuellen Arbeiten.
- **Nächster Schultag**: An Wochenenden, Ferien und Feiertagen wird automatisch der nächste Schultag angezeigt.
- **Hervorhebung von Änderungen**: Stundenausfälle werden rot, Änderungen gelb markiert.
- **Echte Daten**: Alle Daten (Stundenplan, Arbeiten und Ferien) werden direkt aus WebUntis abgerufen.

## Installation

1. Stellen Sie sicher, dass Node.js auf Ihrem System installiert ist.
2. Klonen oder entpacken Sie das Projekt in ein Verzeichnis Ihrer Wahl.
3. Öffnen Sie ein Terminal im Projektverzeichnis und führen Sie folgenden Befehl aus:
   ```
   npm install
   ```

## Konfiguration

1. Erstellen Sie eine Datei `config.json` im Verzeichnis `config` basierend auf der Beispieldatei `config.example.json`.
2. Tragen Sie Ihre WebUntis-Zugangsdaten ein:
   ```json
   {
     "webuntis": {
       "school": "Ihre_Schule",
       "username": "Ihr_Benutzername",
       "password": "Ihr_Passwort",
       "baseUrl": "Ihre_WebUntis_URL"
     },
     "refreshInterval": 30000
   }
   ```
3. Der `refreshInterval` bestimmt die Dauer in Millisekunden, wie lange jede Ansicht (Stundenplan/Arbeiten) angezeigt wird.

## Starten der Anwendung

Führen Sie im Projektverzeichnis folgenden Befehl aus:
```
npm start
```

Die Anwendung ist dann unter http://localhost:3000 erreichbar.

## Technische Details

Die Anwendung verwendet:
- Node.js mit Express.js als Backend
- Bootstrap für das responsive Design
- WebUntis API für den Zugriff auf den Stundenplan, Hausaufgaben und Ferien
- EJS als Template-Engine
- Moment.js für die Datums- und Zeitverarbeitung

## Hinweise zur WebUntis-API

Die Anwendung nutzt folgende WebUntis-API-Funktionen:
- `getOwnTimetableForDay`: Abrufen des Stundenplans für einen bestimmten Tag
- `getHolidays`: Abrufen der Ferienzeiten
- Verschiedene Methoden für Hausaufgaben (je nach WebUntis-Version)

Je nach WebUntis-Version und Konfiguration Ihrer Schule können die verfügbaren API-Funktionen variieren. Bei Problemen prüfen Sie bitte die aktuelle WebUntis-API-Dokumentation und passen Sie den Code entsprechend an.
