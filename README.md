# StarRupture Planer

Ressourcen- und Rezeptplaner für **StarRupture** (Web-App, Deutsch).

## Funktionen

- **Rechner**: Ziel-Item und Menge pro Minute eingeben. Die App zeigt, welche Maschinen du brauchst (exakt und aufgerundet), wie stark die letzte Maschine ausgelastet ist, welche Rohstoffe und Extraktoren nötig sind, wie viel Strom verbraucht wird und wie viele Rails pro Strang nötig sind. Mehrere Ziele gleichzeitig sind möglich. Für jedes Item lässt sich ein Rezept (inkl. v.2-Alternativen) wählen oder auf „Import“ stellen. Ansicht als Tabelle oder Baum.
- **Fabrik-Planer**: Baue deine tatsächliche Kette nach (Maschinentyp, Rezept, Anzahl, Erz-Reinheit, externe Zufuhr). Die Simulation zeigt pro Maschinengruppe:
  - 🟢 voll ausgelastet
  - 🟡 zu wenig Input (mit dem fehlenden Item und der Menge)
  - 🔴 Engpass: Die Ausgabe reicht nicht für die nächste Stufe, inklusive „+N Maschinen nötig“
  - 🔵 Überkapazität: Nachgelagert wird weniger abgenommen, die Maschine pausiert zeitweise
  - Warnungen, wenn ein Strang das Rail-Limit überschreitet
  - ein Knopf „Engpässe automatisch beheben“
  - Item-Bilanz, Export/Import als JSON, Speicherung im Browser
- **Rezepte**: Alle Items durchsuchbar, mit Herstellung, Verwendung und Raten pro Minute.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # Tests (Rechenkern)
npm run build    # Produktions-Build nach dist/
```

Die Spieldaten liegen in `src/data/gameData.ts` und lassen sich nach Patches direkt dort anpassen.

## Datenquelle

[starrupture.wiki.gg](https://starrupture.wiki.gg), Stand Nov. 2026 (Early Access). Wo sich Wiki-Seiten widersprechen, wurde der Wert der Mehrheit übernommen. Solche Rezepte sind in der App mit „?“ bzw. „unsicher“ markiert. Die Rail-Kapazitäten (v1 120, v2 240, v3 480/min) stammen aus Community-Quellen. Fan-Projekt, nicht mit Creepy Jar verbunden.

## Deployment

Der Workflow `.github/workflows/pages.yml` veröffentlicht die App bei jedem Push auf `main` auf GitHub Pages. Dafür einmalig in den Repo-Einstellungen unter *Settings → Pages → Source* „GitHub Actions“ wählen.
