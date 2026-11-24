/*
 * nordisk-karnkraft-card
 * Kort för Home Assistant som visar effekt och status för Sveriges sex kärnreaktorer.
 * Läser vanliga sensorer (MW), t.ex. de som add-onet Nordisk kärnkraft skapar.
 *
 * Copyright (c) 2026 Hagbard. MIT-licens (se LICENSE).
 * Fristående och inofficiellt: ingen koppling eller samarbete med nordiskkarnkraft.se.
 */

const KNOWN_MAX = {
  "oskarshamn 3": 1450,
  "ringhals 3": 1074,
  "ringhals 4": 1134,
  "forsmark 1": 1103,
  "forsmark 2": 1121,
  "forsmark 3": 1172,
};

const STATES = {
  on: { label: "I drift", color: "var(--nk-on, #2fbf8a)" },
  reduced: { label: "Reducerad effekt", color: "var(--nk-reduced, #e8a33d)" },
  off: { label: "Ur drift", color: "var(--nk-off, #8795a0)" },
  unknown: { label: "Saknar data", color: "var(--disabled-text-color, #6f7b84)" },
};

const nf = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const fmt = (n) => nf.format(Math.round(n));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

class NordiskKarnkraftCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._sig = "";
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.reactors) || config.reactors.length === 0) {
      throw new Error("Lägg till minst en reaktor under 'reactors' med en 'entity'.");
    }
    config.reactors.forEach((r) => {
      if (!r.entity) throw new Error("Varje reaktor behöver en 'entity'.");
    });
    this._config = {
      title: "Svensk kärnkraft",
      reduced_threshold: 0.95,
      equal_width: true,
      variant: "bars",
      ...config,
    };
    this._sig = "";
    if (this._hass) this.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const data = this._config.reactors.map((r) => this._read(r));
    const sig = JSON.stringify(data);
    if (sig === this._sig) return;
    this._sig = sig;
    this._render(data);
  }

  getCardSize() {
    return 2 + Math.ceil((this._config?.reactors.length || 6) * 0.6);
  }

  static getStubConfig() {
    return {
      reactors: [
        { entity: "sensor.oskarshamn_3_effekt", name: "Oskarshamn 3" },
        { entity: "sensor.ringhals_3_effekt", name: "Ringhals 3" },
        { entity: "sensor.ringhals_4_effekt", name: "Ringhals 4" },
        { entity: "sensor.forsmark_1_effekt", name: "Forsmark 1" },
        { entity: "sensor.forsmark_2_effekt", name: "Forsmark 2" },
        { entity: "sensor.forsmark_3_effekt", name: "Forsmark 3" },
      ],
    };
  }

  _read(r) {
    const st = this._hass.states[r.entity];
    const name = r.name || st?.attributes?.friendly_name || r.entity;
    const max = Number(r.max ?? KNOWN_MAX[String(name).toLowerCase()] ?? st?.attributes?.max) || 0;

    let power = NaN;
    if (st && st.state !== "unavailable" && st.state !== "unknown") {
      power = parseFloat(String(st.state).replace(",", "."));
      const unit = st.attributes?.unit_of_measurement;
      if (unit === "GW") power *= 1000;
      else if (unit === "kW") power /= 1000;
    }

    const statusText = r.status_entity ? this._hass.states[r.status_entity]?.state : undefined;
    let key;
    if (statusText && !["unavailable", "unknown"].includes(statusText)) {
      const t = statusText.toLowerCase();
      if (/reduc|nedreg|startar|uppstart|ramp/.test(t)) key = "reduced";
      else if (/underh|maint|avbrott|outage|stopp|off|ur drift/.test(t)) key = "off";
      else if (/drift|operat|online|^on$/.test(t)) key = "on";
    }
    if (!key) {
      if (Number.isNaN(power)) key = "unknown";
      else if (power <= 0) key = "off";
      else if (max && power / max < this._config.reduced_threshold) key = "reduced";
      else key = "on";
    }
    const label = statusText && !["unavailable", "unknown"].includes(statusText) ? statusText : STATES[key].label;
    return { entity: r.entity, name, max, power: Number.isNaN(power) ? null : power, key, label };
  }

  _render(data) {
    const cfg = this._config;
    const variant = ["bars", "compact", "rows", "ring"].includes(cfg.variant) ? cfg.variant : "bars";
    const equal = cfg.equal_width !== false;
    const total = data.reduce((s, d) => s + (d.power || 0), 0);
    const cap = data.reduce((s, d) => s + d.max, 0);
    const util = cap ? Math.round((total / cap) * 100) : 0;
    const count = (k) => data.filter((d) => d.key === k).length;

    const summary = [
      `${count("on")} i drift`,
      count("reduced") ? `${count("reduced")} med reducerad effekt` : null,
      count("off") ? `${count("off")} ur drift` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const pctOf = (d) => (d.max && d.power ? Math.min(100, (d.power / d.max) * 100) : 0);
    const tip = (d) => `${esc(d.name)}: ${d.power == null ? "okänd" : fmt(d.power)} / ${fmt(d.max)} MW`;
    const short = (n) => {
      const l = (String(n).match(/[A-Za-zÅÄÖåäö]/) || [""])[0].toUpperCase();
      const num = (String(n).match(/\d+/) || [""])[0];
      return l + num || String(n).slice(0, 3);
    };
    const mwText = (d) => `<b>${d.power == null ? "–" : fmt(d.power)}</b> / ${fmt(d.max)} MW`;

    const title = cfg.title ? `<h2>${esc(cfg.title)}</h2>` : "";
    const totalLine = (cls = "") =>
      `<div class="total ${cls}"><span class="num">${fmt(total)}</span><span>MW</span><span class="of">av ${fmt(cap)} MW, ${util}% utnyttjat</span></div>`;

    const list = data
      .map(
        (d) => `<button class="row" data-entity="${esc(d.entity)}">
          <span class="dot" style="background:${STATES[d.key].color}"></span>
          <span class="name">${esc(d.name)}</span>
          <span class="status">${esc(d.label)}</span>
          <span class="mw">${mwText(d)}</span>
        </button>`
      )
      .join("");

    let body;

    if (variant === "compact") {
      const segs = data
        .map(
          (d) => `<div class="hseg" data-entity="${esc(d.entity)}" title="${tip(d)}">
          <div class="hfill" style="width:${pctOf(d)}%;background:${STATES[d.key].color}"></div></div>`
        )
        .join("");
      const labels = data.map((d) => `<span>${esc(short(d.name))}</span>`).join("");
      body = `${totalLine("small")}
        <div class="sub">${esc(summary)}</div>
        <div class="hstrip" style="grid-template-columns:repeat(${data.length},1fr)" role="img" aria-label="Effekt per reaktor">${segs}</div>
        <div class="hlabels" style="grid-template-columns:repeat(${data.length},1fr)">${labels}</div>`;
    } else if (variant === "rows") {
      const rows2 = data
        .map(
          (d) => `<button class="row2" data-entity="${esc(d.entity)}">
          <span class="r2-top">
            <span class="dot" style="background:${STATES[d.key].color}"></span>
            <span class="name">${esc(d.name)}</span>
            <span class="status">${esc(d.label)}</span>
            <span class="mw">${mwText(d)}</span>
          </span>
          <span class="bar"><span class="barfill" style="width:${pctOf(d)}%;background:${STATES[d.key].color}"></span></span>
        </button>`
        )
        .join("");
      body = `${totalLine()}
        <div class="sub">${esc(summary)}</div>
        <div class="rows">${rows2}</div>`;
    } else if (variant === "ring") {
      const n = data.length;
      const R = 42;
      const C = 2 * Math.PI * R;
      const gap = n > 1 ? 3 : 0;
      let off = 0;
      const arcs = data
        .map((d) => {
          const share = equal || !cap ? 1 / n : d.max / cap;
          const L = Math.max(0, C * share - gap);
          const fill = (L * pctOf(d)) / 100;
          const o = off;
          off += C * share;
          const base = `cx="50" cy="50" r="${R}" fill="none" stroke-width="9"`;
          return (
            `<circle ${base} stroke="var(--divider-color, rgba(127,127,127,.25))" stroke-dasharray="${L} ${C}" stroke-dashoffset="${-o}"><title>${tip(d)}</title></circle>` +
            (fill > 0
              ? `<circle ${base} stroke="${STATES[d.key].color}" stroke-dasharray="${fill} ${C}" stroke-dashoffset="${-o}"><title>${tip(d)}</title></circle>`
              : "")
          );
        })
        .join("");
      body = `<div class="sub ringsub">${esc(summary)}</div>
        <div class="ringlayout">
          <div class="ringwrap">
            <svg viewBox="0 0 100 100" role="img" aria-label="Total effekt"><g transform="rotate(-90 50 50)">${arcs}</g></svg>
            <div class="ringtxt"><span class="rnum">${fmt(total)}</span><span class="runit">MW</span><span class="rpct">${util}% av ${fmt(cap)}</span></div>
          </div>
          <div class="rows ringlist">${list}</div>
        </div>`;
    } else {
      const strip = data
        .map(
          (d) => `<div class="seg" style="flex:${equal ? 1 : d.max || 1}" title="${tip(d)}">
          <div class="fill" style="height:${pctOf(d)}%;background:${STATES[d.key].color}"></div></div>`
        )
        .join("");
      body = `${totalLine()}
        <div class="sub">${esc(summary)}</div>
        <div class="strip" role="img" aria-label="Effekt per reaktor">${strip}</div>
        <div class="rows">${list}</div>`;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 16px; overflow: hidden; color: var(--primary-text-color); }
        h2 { margin: 0 0 12px; font-size: 1rem; font-weight: 500; color: var(--secondary-text-color); }
        .total { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .total .num { font-size: 2.6rem; font-weight: 300; letter-spacing: -0.02em; line-height: 1; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
        .total.small .num { font-size: 1.8rem; }
        .total .of { color: var(--secondary-text-color); font-size: 0.95rem; }
        .sub { margin: 6px 0 14px; color: var(--secondary-text-color); font-size: 0.85rem; }
        .strip { display: flex; gap: 3px; height: 56px; margin-bottom: 14px; }
        .seg { position: relative; min-width: 6px; border-radius: 4px; background: var(--divider-color, rgba(127,127,127,.2)); overflow: hidden; }
        .fill { position: absolute; left: 0; right: 0; bottom: 0; transition: height .6s ease; }
        [data-entity] { cursor: pointer; }
        .row { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 10px 1fr auto auto; gap: 10px; align-items: center; width: 100%; padding: 8px 4px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.2)); cursor: pointer; color: var(--primary-text-color); font-size: 0.9rem; }
        .row:first-of-type, .row2:first-of-type { border-top: 0; }
        .row:focus-visible, .row2:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; border-radius: 4px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .status { color: var(--secondary-text-color); font-size: 0.8rem; text-align: right; }
        .mw { text-align: right; min-width: 8.5em; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
        .mw b { color: var(--primary-text-color); font-weight: 500; }
        .row2 { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 9px 4px; border-top: 1px solid var(--divider-color, rgba(127,127,127,.2)); cursor: pointer; color: var(--primary-text-color); font-size: 0.9rem; }
        .r2-top { display: grid; grid-template-columns: 10px 1fr auto auto; gap: 10px; align-items: center; }
        .bar { display: block; height: 6px; margin-top: 7px; border-radius: 3px; background: var(--divider-color, rgba(127,127,127,.2)); overflow: hidden; }
        .barfill { display: block; height: 100%; border-radius: 3px; transition: width .6s ease; }
        .hstrip, .hlabels { display: grid; gap: 3px; }
        .hseg { height: 12px; border-radius: 4px; background: var(--divider-color, rgba(127,127,127,.2)); overflow: hidden; }
        .hfill { height: 100%; transition: width .6s ease; }
        .hlabels { margin-top: 6px; font-size: 0.75rem; color: var(--secondary-text-color); text-align: center; }
        .ringlayout { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; }
        .ringsub { margin-bottom: 8px; }
        .ringwrap { position: relative; width: 150px; flex: none; margin: 0 auto; }
        .ringwrap svg { display: block; width: 100%; height: auto; }
        .ringwrap circle { transition: stroke-dasharray .6s ease; }
        .ringtxt { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.15; }
        .rnum { font-size: 1.7rem; font-weight: 300; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
        .runit { font-size: 0.8rem; color: var(--secondary-text-color); }
        .rpct { font-size: 0.7rem; color: var(--secondary-text-color); margin-top: 2px; }
        .ringlist { flex: 1 1 240px; min-width: 0; }
        @media (max-width: 420px) { .status { display: none; } .row { grid-template-columns: 10px 1fr auto; } .r2-top { grid-template-columns: 10px 1fr auto; } }
        @media (prefers-reduced-motion: reduce) { .fill, .barfill, .hfill, .ringwrap circle { transition: none; } }
      </style>
      <ha-card>
        ${title}
        ${body}
      </ha-card>`;

    this.shadowRoot.querySelectorAll("[data-entity]").forEach((el) =>
      el.addEventListener("click", () =>
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            bubbles: true,
            composed: true,
            detail: { entityId: el.dataset.entity },
          })
        )
      )
    );
  }
}

customElements.define("nordisk-karnkraft-card", NordiskKarnkraftCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "nordisk-karnkraft-card",
  name: "Nordisk kärnkraft",
  description: "Effekt och status för Sveriges sex kärnreaktorer.",
});
