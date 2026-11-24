#!/usr/bin/env python3
"""Hämtar reaktordata från nordiskkarnkraft.se och publicerar den som sensorer i Home Assistant.

Copyright (c) 2026 Hagbard. MIT-licens (se LICENSE).
Fristående och inofficiellt: ingen koppling eller samarbete med nordiskkarnkraft.se.
"""
import html
import json
import os
import re
import shutil
import time
import urllib.request

OPTIONS = json.load(open("/data/options.json"))
URL = OPTIONS.get("url", "https://www.nordiskkarnkraft.se/sv/se")
INTERVAL = max(3, int(OPTIONS.get("interval_minutes", 5))) * 60
TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
API = "http://supervisor/core/api"
UA = "HomeAssistant-NordiskKarnkraft-addon/0.1 (hobbyprojekt, hämtar sällan)"

NAMES = ["Oskarshamn 3", "Ringhals 3", "Ringhals 4", "Forsmark 1", "Forsmark 2", "Forsmark 3"]
# Namn, ort ("... län"), valfritt statusord, procent, "Nuvarande effekt", effekt / maxeffekt MW.
# Statusordet matchas fritt så att nya ord som "Startar upp" också fungerar.
REACTOR_RE = re.compile(
    r"(?P<name>" + "|".join(NAMES) + r") .{0,60}? län "
    r"(?P<status>[^\d%]{2,40}?) (?P<pct>\d+) ?% "
    r"Nuvarande effekt (?P<power>[\d ]+?) / (?P<max>[\d ]+?) MW"
)


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": UA, "Accept-Language": "sv"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


def to_text(raw):
    raw = re.sub(r"<(script|style)\b.*?</\1>", " ", raw, flags=re.S | re.I)
    raw = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(raw))


def number(s):
    return int(re.sub(r"\D", "", s))


def parse(raw):
    text = to_text(raw)
    found = {}
    for m in REACTOR_RE.finditer(text):
        found.setdefault(
            m["name"],
            {"name": m["name"], "status": m["status"].strip(), "power": number(m["power"]), "max": number(m["max"])},
        )
    return [found[n] for n in NAMES if n in found]


def slug(name):
    return name.lower().replace(" ", "_")


def post_state(entity_id, state, attributes):
    body = json.dumps({"state": str(state), "attributes": attributes}).encode()
    req = urllib.request.Request(
        f"{API}/states/{entity_id}",
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=15).read()


def publish(reactors):
    for r in reactors:
        s = slug(r["name"])
        pct = round(100 * r["power"] / r["max"]) if r["max"] else 0
        post_state(
            f"sensor.{s}_effekt",
            r["power"],
            {
                "friendly_name": f"{r['name']} effekt",
                "unit_of_measurement": "MW",
                "device_class": "power",
                "state_class": "measurement",
                "icon": "mdi:atom",
                "max": r["max"],
                "utilization": pct,
                "status": r["status"],
                "attribution": "Data via nordiskkarnkraft.se",
            },
        )
        post_state(
            f"sensor.{s}_status",
            r["status"],
            {"friendly_name": f"{r['name']} status", "icon": "mdi:atom"},
        )
    total = sum(r["power"] for r in reactors)
    cap = sum(r["max"] for r in reactors)
    post_state(
        "sensor.svensk_karnkraft_total_effekt",
        total,
        {
            "friendly_name": "Svensk kärnkraft total effekt",
            "unit_of_measurement": "MW",
            "device_class": "power",
            "state_class": "measurement",
            "capacity": cap,
            "utilization": round(100 * total / cap) if cap else 0,
            "reactors_found": len(reactors),
        },
    )


def mark_unavailable():
    for n in NAMES:
        for suffix in ("effekt", "status"):
            try:
                post_state(f"sensor.{slug(n)}_{suffix}", "unavailable", {"friendly_name": f"{n} {suffix}"})
            except Exception:
                pass


def install_card():
    if not OPTIONS.get("install_card", True):
        return
    dst_dir = "/homeassistant/www"
    try:
        os.makedirs(dst_dir, exist_ok=True)
        shutil.copyfile("/app/nordisk-karnkraft-card.js", f"{dst_dir}/nordisk-karnkraft-card.js")
        log("Kortet ligger i /config/www/nordisk-karnkraft-card.js (resurs: /local/nordisk-karnkraft-card.js)")
    except Exception as e:
        log(f"Kunde inte kopiera kortet: {e}")


def main():
    install_card()
    failures = 0
    while True:
        try:
            reactors = parse(fetch())
            if not reactors:
                raise RuntimeError("Hittade inga reaktorer på sidan. Har layouten ändrats?")
            if len(reactors) < len(NAMES):
                log(f"Varning: hittade bara {len(reactors)} av {len(NAMES)} reaktorer.")
            publish(reactors)
            failures = 0
            log("Uppdaterade: " + ", ".join(f"{r['name']} {r['power']} MW ({r['status']})" for r in reactors))
        except Exception as e:
            failures += 1
            log(f"Fel ({failures}): {e}")
            if failures == 3:
                mark_unavailable()
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
