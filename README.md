# Nordisk kärnkraft för Home Assistant

Visa hur mycket el Sveriges sex kärnreaktorer producerar just nu, direkt på din Home Assistant-dashboard.

Paketet innehåller:

- ett **add-on** som hämtar effekt och status för Oskarshamn 3, Ringhals 3 och 4 samt Forsmark 1, 2 och 3 och skapar sensorer i Home Assistant
- ett **dashboardkort** som visar total effekt, en stapel per reaktor och status (I drift, Reducerad effekt, Underhåll och så vidare)

> **Inofficiellt.** Det här projektet har ingen koppling eller något samarbete med [nordiskkarnkraft.se](https://www.nordiskkarnkraft.se) eller dess skapare, och är inte godkänt av dem. Datan hämtas från den publika sidan, och namnet används bara för att visa varifrån den kommer.

## Krav

Du behöver **Home Assistant OS** eller **Supervised**, eftersom add-ons inte finns i installationstyperna Container och Core.

## Installation

### 1. Lägg till add-onet

Klicka på knappen, eller gör det manuellt:

[![Lägg till i Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FHagbard-84%2Fnordisk-karnkraft-card)

Manuellt: gå till **Inställningar → Add-ons → Add-on-butik**, klicka på de tre prickarna uppe till höger, välj **Databaser** (Repositories) och klistra in:

```
https://github.com/Hagbard-84/nordisk-karnkraft-card
```

### 2. Installera och starta

Leta upp **Nordisk kärnkraft** i butiken (ladda om sidan om det inte syns), klicka på **Installera** och sedan **Starta**. Öppna fliken **Logg**. Efter någon minut ska det stå vilka reaktorer som hittades och deras effekt.

Add-onet skapar sensorerna `sensor.oskarshamn_3_effekt`, `sensor.ringhals_3_status` och så vidare för alla sex reaktorerna, plus `sensor.svensk_karnkraft_total_effekt`. Du ser dem under **Utvecklarverktyg → Tillstånd**.

### 3. Lägg till kortet som resurs

Kortfilen läggs automatiskt i `/config/www/`, men du måste tala om för Home Assistant att den finns. Det gör du en gång:

1. Slå på **Avancerat läge** i din profil (klicka på ditt namn längst ner i vänstermenyn).
2. Gå till **Inställningar → Dashboards**, klicka på de tre prickarna uppe till höger och välj **Resurser**.
3. Klicka på **Lägg till resurs**, skriv `/local/nordisk-karnkraft-card.js` och välj **JavaScript-modul**.
4. Ladda om webbläsaren helt med Ctrl+Shift+R.

Fanns inte mappen `www` sedan tidigare behöver du starta om Home Assistant en gång.

### 4. Lägg till kortet på dashboarden

Redigera en dashboard, klicka på **Lägg till kort**, scrolla ner och välj **Manuellt**. Klistra in:

```yaml
type: custom:nordisk-karnkraft-card
title: Svensk kärnkraft
reactors:
  - entity: sensor.oskarshamn_3_effekt
    status_entity: sensor.oskarshamn_3_status
    name: Oskarshamn 3
  - entity: sensor.ringhals_3_effekt
    status_entity: sensor.ringhals_3_status
    name: Ringhals 3
  - entity: sensor.ringhals_4_effekt
    status_entity: sensor.ringhals_4_status
    name: Ringhals 4
  - entity: sensor.forsmark_1_effekt
    status_entity: sensor.forsmark_1_status
    name: Forsmark 1
  - entity: sensor.forsmark_2_effekt
    status_entity: sensor.forsmark_2_status
    name: Forsmark 2
  - entity: sensor.forsmark_3_effekt
    status_entity: sensor.forsmark_3_status
    name: Forsmark 3
```

Spara. Om du klickar på en reaktor i listan öppnas dess historik.

Vill du ha ett annat utseende, se avsnittet Utseenden längre ner.

## Utseenden

Kortet har fyra utseenden. Välj med `variant:` i kortets YAML. Utan val används `bars`.

| `variant` | Utseende |
|---|---|
| `bars` | Total effekt, en kolumn per reaktor och en lista under. |
| `compact` | Smalt kort med total effekt och en tunn stapel per reaktor, med korta namn (O3, R3, R4, F1, F2, F3). Passar där du har lite plats. |
| `rows` | Total effekt och en lista där varje reaktor har en egen framstegsstapel. |
| `ring` | En ring med ett segment per reaktor och total effekt i mitten, med listan under. |

Exempel:

```yaml
type: custom:nordisk-karnkraft-card
variant: ring
reactors:
  # ...samma lista som ovan
```

I `bars` och `ring` är segmenten lika stora som standard. Lägg till `equal_width: false` om storleken ska följa varje reaktors maxeffekt.

## Inställningar för add-onet

| Inställning | Standard | Beskrivning |
|---|---|---|
| `url` | `https://www.nordiskkarnkraft.se/sv/se` | Sidan datan hämtas från. Behåll `/sv/`, eftersom tolkningen letar efter svenska statusord. |
| `interval_minutes` | `5` | Hur ofta sidan hämtas (3–60 minuter). Sidan uppdateras själv var 3:e minut. |
| `install_card` | `true` | Kopierar kortfilen till `/config/www/` när add-onet startar. |

## Felsökning

- **Add-onet syns inte i butiken.** Kontrollera att adressen i Databaser är rätt, välj Sök efter uppdateringar i menyn med de tre prickarna och ladda om sidan med Ctrl+Shift+R.
- **Kortet visar "Custom element doesn't exist".** Resursen är inte tillagd eller webbläsaren har gammal cache. Gör steg 3 igen.
- **Kortet visar "Saknar data".** Sensorerna finns inte. Titta i add-onets logg.
- **Loggen säger "Hittade inga reaktorer".** Datan hämtas ur sidans text, så om sidan ändrar utseende eller ordval kan tolkningen sluta fungera. Öppna gärna ett ärende här med vad loggen visar.

## Att tänka på

- Sidan är ett hobbyprojekt som någon annan driver och betalar för. Behåll intervallet på 5 minuter eller mer och belasta den inte i onödan.
- Datan visas i befintligt skick och kan vara försenad. Använd den inte för beslut där riktigheten är viktig.
- Sensorerna skapas via Home Assistants API och saknar unikt id. De återskapas varje gång add-onet startar och går inte att döpa om i gränssnittet.

## Licens

MIT. Se [LICENSE](LICENSE). Copyright (c) 2026 Hagbard.
