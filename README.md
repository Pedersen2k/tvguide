# Tv-guide

Enkel tv-guide med store knapper og tydelig tekst. Mørk bakgrunn, skriften Atkinson Hyperlegible, og tre tekststørrelser.

- **Forside:** før kl. 17 vises «I kveld kl. 20.00», ellers «Nå på tv». En knapp bytter.
- **Se alt i kveld:** velg Nå, 19.00, 20.00, 21.00, 22.00 eller 23.00.
- **Trykk på en kanal:** hele kvelden for den kanalen, med programmet kl. 20.00 markert i gult.

## Kjøre lokalt

```bash
python3 tools/fetch_guide.py          # henter data/guide.json
python3 -m http.server 8000           # åpne http://localhost:8000
```

## Datakilder

| Kanal | Kilde | Status |
|---|---|---|
| NRK1 | NRKs åpne program-API (`psapi.nrk.no`) | Fungerer |
| TV 2 | `tvguide.vg.no` (kanalen «TV 2 Direkte») | Fungerer |
| TVNorge | `tvguide.vg.no` | Fungerer |
| TV3 | `tvguide.vg.no` | VG har foreløpig ingen programmer for TV3. Må sjekkes senere |
| TV 2 Zebra, FEM | `tvguide.vg.no` | Fungerer |

VG-siden leses som en vanlig nettleser ville gjort det: programlisten ligger i HTML-en til hver kanalside. VGs robots.txt tillater dette (ikke AI-roboter, og ikke søk med `?`). Skriptet identifiserer seg, venter halvannet sekund mellom hver forespørsel og kjører bare to ganger i døgnet. Sidene er VGs, så bruk det til personlig bruk og ikke legg guiden ut offentlig som en tjeneste. Endrer VG oppbyggingen av siden, vil `fetch_vg` i `tools/fetch_guide.py` feile, og kanalen viser «Programoversikten er ikke tilgjengelig akkurat nå».

Vil du overstyre en kanal, skriv programmene i `data/manual/<id>.json` (`nrk1`, `tv2`, `tvnorge`, `tv3`). En manuell fil har forrang:

```json
[["2026-10-29T20:00:00+01:00", "2026-10-29T21:30:00+01:00", "Farmen", "Reality"]]
```

`python3 tools/fetch_guide.py --demo` fyller kanaler uten data med oppdiktede eksempelprogram, bare for forhåndsvisning.

## Legge ut på nett

Alt er statiske filer. Legg mappen på GitHub Pages, Netlify eller lignende. Arbeidsflyten `.github/workflows/oppdater.yml` henter nye programmer to ganger i døgnet. På mammas nettbrett: åpne adressen og velg «Legg til på startskjermen».
