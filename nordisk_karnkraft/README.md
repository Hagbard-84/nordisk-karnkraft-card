# Nordisk kärnkraft

Skapad av Hagbard. Licens: MIT (se filen LICENSE).

**Ingen koppling till nordiskkarnkraft.se.** Det här är ett fristående, inofficiellt tillägg. Det har inget samarbete med, och är inte godkänt eller sponsrat av, Nordisk kärnkraft eller dess skapare. Namnet på tjänsten används bara för att berätta varifrån datan hämtas.
*This is an independent, unofficial add-on. It is not affiliated with, endorsed by, or sponsored by nordiskkarnkraft.se or its creator.*

Add-onet hämtar effekt och status för Sveriges sex reaktorer från nordiskkarnkraft.se och skapar sensorer:

- `sensor.<reaktor>_effekt` (MW), t.ex. `sensor.oskarshamn_3_effekt`
- `sensor.<reaktor>_status` (text), t.ex. `sensor.ringhals_3_status`
- `sensor.svensk_karnkraft_total_effekt`

Kortfilen läggs i `/config/www/`. Lägg till `/local/nordisk-karnkraft-card.js` som JavaScript-modul under Resurser.

Sidan är ett hobbyprojekt som någon annan driver och betalar för. Behåll intervallet på 5 minuter eller mer, så att du inte belastar den i onödan. Behåll /sv/-adressen, eftersom tolkningen letar efter svenska statusord. Eftersom datan hämtas ur sidans text kan tolkningen sluta fungera om sidan ändras.
