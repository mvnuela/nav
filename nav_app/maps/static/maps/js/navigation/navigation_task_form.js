import Ajv2020 from "https://esm.sh/ajv@8.17.1/dist/2020.js";

// minutesToDegrees()/roundTo() come from angle_units.js and formatPositionText()
// from graticule_formatter.js, both loaded as plain scripts by the template —
// their globals are in place before this deferred module runs.

const schema = JSON.parse(document.getElementById("ntSchema").textContent);
// multipleOfPrecision: without it Ajv checks multipleOf by exact float division,
// and a legal 4-decimal value like 18.7826 fails (18.7826/0.0001 is 187825.999…).
const ajv = new Ajv2020({ allErrors: true, strict: false, multipleOfPrecision: 6 });
const validate = ajv.compile(schema);

// min/max prefill the angle-range inputs
const POINTS_OF_SAIL = [
    { key: "close_hauled", label: "Close hauled", min_deg: 23,  max_deg: 67.9 },
    { key: "beam_reach",   label: "Beam reach",   min_deg: 68,  max_deg: 112.9 },
    { key: "broad_reach",  label: "Broad reach",  min_deg: 113, max_deg: 157.9 },
    { key: "running",      label: "Running",      min_deg: 158, max_deg: 180 },
];

// Hardcoded timezone list feeding the #tzSelect dropdown. Selecting an entry
// auto-fills the #tzOffset field with `offset`.
const TIMEZONES = [
    { group: "Universal",      name: "UTC",                 offset: "+00:00", label: "UTC (UTC+00:00)" },

    { group: "Western Europe", name: "Europe/London",       offset: "+00:00", label: "Europe/London — GMT (winter, UTC+00:00)" },
    { group: "Western Europe", name: "Europe/London",       offset: "+01:00", label: "Europe/London — BST (summer, UTC+01:00)" },
    { group: "Western Europe", name: "Europe/Lisbon",       offset: "+00:00", label: "Europe/Lisbon — WET (winter, UTC+00:00)" },
    { group: "Western Europe", name: "Europe/Lisbon",       offset: "+01:00", label: "Europe/Lisbon — WEST (summer, UTC+01:00)" },

    { group: "Central Europe", name: "Europe/Warsaw",       offset: "+01:00", label: "Europe/Warsaw — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Warsaw",       offset: "+02:00", label: "Europe/Warsaw — CEST (summer, UTC+02:00)" },
    { group: "Central Europe", name: "Europe/Berlin",       offset: "+01:00", label: "Europe/Berlin — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Berlin",       offset: "+02:00", label: "Europe/Berlin — CEST (summer, UTC+02:00)" },
    { group: "Central Europe", name: "Europe/Amsterdam",    offset: "+01:00", label: "Europe/Amsterdam — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Amsterdam",    offset: "+02:00", label: "Europe/Amsterdam — CEST (summer, UTC+02:00)" },
    { group: "Central Europe", name: "Europe/Paris",        offset: "+01:00", label: "Europe/Paris — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Paris",        offset: "+02:00", label: "Europe/Paris — CEST (summer, UTC+02:00)" },
    { group: "Central Europe", name: "Europe/Copenhagen",   offset: "+01:00", label: "Europe/Copenhagen — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Copenhagen",   offset: "+02:00", label: "Europe/Copenhagen — CEST (summer, UTC+02:00)" },
    { group: "Central Europe", name: "Europe/Oslo",         offset: "+01:00", label: "Europe/Oslo — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Oslo",         offset: "+02:00", label: "Europe/Oslo — CEST (summer, UTC+02:00)" },
    { group: "Central Europe", name: "Europe/Stockholm",    offset: "+01:00", label: "Europe/Stockholm — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Stockholm",    offset: "+02:00", label: "Europe/Stockholm — CEST (summer, UTC+02:00)" },
    { group: "Central Europe", name: "Europe/Madrid",       offset: "+01:00", label: "Europe/Madrid — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Madrid",       offset: "+02:00", label: "Europe/Madrid — CEST (summer, UTC+02:00)" },
    { group: "Central Europe", name: "Europe/Rome",         offset: "+01:00", label: "Europe/Rome — CET (winter, UTC+01:00)" },
    { group: "Central Europe", name: "Europe/Rome",         offset: "+02:00", label: "Europe/Rome — CEST (summer, UTC+02:00)" },

    { group: "Eastern Europe", name: "Europe/Helsinki",     offset: "+02:00", label: "Europe/Helsinki — EET (winter, UTC+02:00)" },
    { group: "Eastern Europe", name: "Europe/Helsinki",     offset: "+03:00", label: "Europe/Helsinki — EEST (summer, UTC+03:00)" },
    { group: "Eastern Europe", name: "Europe/Riga",         offset: "+02:00", label: "Europe/Riga — EET (winter, UTC+02:00)" },
    { group: "Eastern Europe", name: "Europe/Riga",         offset: "+03:00", label: "Europe/Riga — EEST (summer, UTC+03:00)" },
    { group: "Eastern Europe", name: "Europe/Tallinn",      offset: "+02:00", label: "Europe/Tallinn — EET (winter, UTC+02:00)" },
    { group: "Eastern Europe", name: "Europe/Tallinn",      offset: "+03:00", label: "Europe/Tallinn — EEST (summer, UTC+03:00)" },
    { group: "Eastern Europe", name: "Europe/Athens",       offset: "+02:00", label: "Europe/Athens — EET (winter, UTC+02:00)" },
    { group: "Eastern Europe", name: "Europe/Athens",       offset: "+03:00", label: "Europe/Athens — EEST (summer, UTC+03:00)" },
    { group: "Eastern Europe", name: "Europe/Kaliningrad",  offset: "+02:00", label: "Europe/Kaliningrad — EET (UTC+02:00)" },
    { group: "Eastern Europe", name: "Europe/Moscow",       offset: "+03:00", label: "Europe/Moscow — MSK (UTC+03:00)" },

    { group: "Americas",       name: "America/New_York",    offset: "-05:00", label: "America/New_York — EST (winter, UTC−05:00)" },
    { group: "Americas",       name: "America/New_York",    offset: "-04:00", label: "America/New_York — EDT (summer, UTC−04:00)" },
    { group: "Americas",       name: "America/Chicago",     offset: "-06:00", label: "America/Chicago — CST (winter, UTC−06:00)" },
    { group: "Americas",       name: "America/Chicago",     offset: "-05:00", label: "America/Chicago — CDT (summer, UTC−05:00)" },
    { group: "Americas",       name: "America/Denver",      offset: "-07:00", label: "America/Denver — MST (winter, UTC−07:00)" },
    { group: "Americas",       name: "America/Denver",      offset: "-06:00", label: "America/Denver — MDT (summer, UTC−06:00)" },
    { group: "Americas",       name: "America/Los_Angeles", offset: "-08:00", label: "America/Los_Angeles — PST (winter, UTC−08:00)" },
    { group: "Americas",       name: "America/Los_Angeles", offset: "-07:00", label: "America/Los_Angeles — PDT (summer, UTC−07:00)" },

    { group: "Atlantic",       name: "Atlantic/Canary",     offset: "+00:00", label: "Atlantic/Canary — WET (winter, UTC+00:00)" },
    { group: "Atlantic",       name: "Atlantic/Canary",     offset: "+01:00", label: "Atlantic/Canary — WEST (summer, UTC+01:00)" },
    { group: "Atlantic",       name: "Atlantic/Cape_Verde", offset: "-01:00", label: "Atlantic/Cape_Verde (UTC−01:00)" },
    { group: "Atlantic",       name: "Atlantic/Azores",     offset: "-01:00", label: "Atlantic/Azores (winter, UTC−01:00)" },
    { group: "Atlantic",       name: "Atlantic/Azores",     offset: "+00:00", label: "Atlantic/Azores (summer, UTC+00:00)" },

    { group: "Rest of world",  name: "Asia/Dubai",          offset: "+04:00", label: "Asia/Dubai — GST (UTC+04:00)" },
    { group: "Rest of world",  name: "Asia/Singapore",      offset: "+08:00", label: "Asia/Singapore (UTC+08:00)" },
    { group: "Rest of world",  name: "Asia/Tokyo",          offset: "+09:00", label: "Asia/Tokyo — JST (UTC+09:00)" },
    { group: "Rest of world",  name: "Australia/Sydney",    offset: "+10:00", label: "Australia/Sydney — AEST (winter, UTC+10:00)" },
    { group: "Rest of world",  name: "Australia/Sydney",    offset: "+11:00", label: "Australia/Sydney — AEDT (summer, UTC+11:00)" },
    { group: "Rest of world",  name: "Pacific/Auckland",    offset: "+12:00", label: "Pacific/Auckland — NZST (winter, UTC+12:00)" },
    { group: "Rest of world",  name: "Pacific/Auckland",    offset: "+13:00", label: "Pacific/Auckland — NZDT (summer, UTC+13:00)" },
];

// ---------- Row builders ----------
// A field's hint span is either static text — position text explains that it is
// derived — or, with hint: true, an empty span the calculator button writes its
// explanation into.
function hintSpan(hint) {
    if (hint === true) return '<span class="hint"></span>';
    return hint ? `<span class="hint">${hint}</span>` : "";
}

function num(name, label, opts = {}) {
    const { step = "0.1", min, max, required = true, hint = false, value, list } = opts;
    const attrs = [
        `type="number"`, `step="${step}"`, `name="${name}"`,
        min !== undefined ? `min="${min}"` : "",
        max !== undefined ? `max="${max}"` : "",
        value !== undefined ? `value="${value}"` : "",
        list ? `list="${list}"` : "",
        required ? "required" : "",
    ].filter(Boolean).join(" ");
    return `
        <div class="field">
            <label>${label}${required ? ' <span class="req">*</span>' : ""}</label>
            <input ${attrs}>
            ${hintSpan(hint)}
        </div>`;
}

function text(name, label, { required = true, placeholder = "", readOnly = false, hint = "" } = {}) {
    return `
        <div class="field">
            <label>${label}${required ? ' <span class="req">*</span>' : ""}</label>
            <input type="text" name="${name}"${required ? " required" : ""}${readOnly ? " readonly" : ""}${placeholder ? ` placeholder="${placeholder}"` : ""}>
            ${hintSpan(hint)}
        </div>`;
}

// A latitude/longitude field. Text, not number: it accepts nautical notation
// ("54°22.5'N", comma decimals) and is normalised to decimal degrees on blur
// by the data-coord focusout listener. The hint span is where that listener
// puts its rejection message, so every coordinate field has one.
const COORD_PLACEHOLDER = { lat: "54.375 or 54°22.5'N", lon: "18.5 or 018°34.2'E" };

function coord(name, label, axis) {
    return `
        <div class="field">
            <label>${label} <span class="req">*</span></label>
            <input type="text" name="${name}" data-coord="${axis}"
                   placeholder="${COORD_PLACEHOLDER[axis]}" required>
            <span class="hint"></span>
        </div>`;
}

function rowWrap(title, idx, inner, extraButtons = "") {
    return `
        <div class="row" data-idx="${idx}">
            <div class="row-title">
                <span>${title} #${idx + 1}</span>
                <span class="row-actions">
                    ${extraButtons}
                    <button type="button" class="remove-btn">Remove</button>
                </span>
            </div>
            ${inner}
            ${extraButtons ? '<div class="calc-summary" hidden></div>' : ""}
        </div>`;
}

// ---- magnetic variation ----/
function mvRowHTML(idx) {
    const inner = `
        <div class="grid">
            ${num(`mv.${idx}.base_deg`,         "Base variation (°)")}
            ${num(`mv.${idx}.base_year`,        "Base year", { step: "1", min: 1900, max: 2100 })}
            ${num(`mv.${idx}.annual_change_min`,"Annual change (′/yr)", { step: "0.1" })}
            ${coord(`mv.${idx}.lat`, "Latitude (°)", "lat")}
            ${coord(`mv.${idx}.lon`, "Longitude (°)", "lon")}
            ${num(`mv.${idx}.range_nm`,         "Range (nm)",    { min: 0 })}
        </div>`;
    return rowWrap("Variation", idx, inner);
}

// ---- compass deviation card: fixed 10° headings (0…350), deviation optional ----
// A standard deviation card: 36 headings every 10°, laid out as a compact
// 4-column table (heading | deviation | heading | deviation). Headings are
// fixed; the teacher fills only the deviation values. Empty cells are skipped
// on export — at least one deviation is required (schema minItems: 1).
const CD_HEADINGS = Array.from({ length: 36 }, (_, i) => i * 10); // 0,10,…,350

function cdCell(idx) {
    const heading = CD_HEADINGS[idx];
    return `
        <div class="dev-cell">
            <span class="hdg">${heading}°</span>
            <input type="number" step="0.5" name="cd.${idx}.deviation_deg"
                   placeholder="dev" aria-label="Deviation at ${heading}°">
        </div>`;
}

// Cells are emitted in heading order so Tab walks 0° → 10° → 20°…; .dev-card
// fills by column, which still lays them out as 0…170 left, 180…350 right.
function cdCardHTML() {
    const cells = CD_HEADINGS.map((_, i) => cdCell(i)).join("");
    return `<div class="dev-card">${cells}</div>`;
}

// ---- leeway: 4 fixed entries, not dynamic ----
function leewayHTML() {
    return POINTS_OF_SAIL.map((p, i) => `
        <div class="row" data-pos="${p.key}">
            <div class="row-title"><span>${p.label}</span></div>
            <div class="grid">
                ${num(`lw.${p.key}.min_deg`,   "Min angle (°)",  { min: 0, max: 359.9, step: "0.1", value: p.min_deg })}
                ${num(`lw.${p.key}.max_deg`,   "Max angle (°)",  { min: 0, max: 359.9, step: "0.1", value: p.max_deg })}
                ${num(`lw.${p.key}.value_deg`, "Leeway value (°)", { step: "0.5" })}
            </div>
        </div>`).join("");
}

// ---- POI ----
function poiRowHTML(idx) {
    const inner = `
        <div class="grid">
            ${text(`poi.${idx}.name`, "Name")}
            ${text(`poi.${idx}.type`, "Type", { placeholder: "buoy / lighthouse / ..." })}
            ${coord(`poi.${idx}.lat`, "Latitude (°)", "lat")}
            ${coord(`poi.${idx}.lon`, "Longitude (°)", "lon")}
        </div>
        <div class="field" style="margin-top:8px">
            <label>Description</label>
            <textarea name="poi.${idx}.description" rows="2"></textarea>
        </div>`;
    return rowWrap("POI", idx, inner);
}

// ---- wind true: 16-point compass suggestions ----
// The field is a plain number input backed by a datalist, so the teacher can
// pick one of the 16 points or type any other bearing. Only the number is
// stored in the exported JSON either way.
const WIND_DIRECTIONS = [
    { name: "N",   deg: 0 },
    { name: "NNE", deg: 22.5 },
    { name: "NE",  deg: 45 },
    { name: "ENE", deg: 67.5 },
    { name: "E",   deg: 90 },
    { name: "ESE", deg: 112.5 },
    { name: "SE",  deg: 135 },
    { name: "SSE", deg: 157.5 },
    { name: "S",   deg: 180 },
    { name: "SSW", deg: 202.5 },
    { name: "SW",  deg: 225 },
    { name: "WSW", deg: 247.5 },
    { name: "W",   deg: 270 },
    { name: "WNW", deg: 292.5 },
    { name: "NW",  deg: 315 },
    { name: "NNW", deg: 337.5 },
];

const WIND_LIST_ID = "windDirections";

// One datalist shared by every track row; injected once, below.
function windDatalistHTML() {
    const options = WIND_DIRECTIONS
        .map(w => `<option value="${w.deg}">${w.name}</option>`)
        .join("");
    return `<datalist id="${WIND_LIST_ID}">${options}</datalist>`;
}

function windField(name, label) {
    return num(name, label, {
        min: 0, max: 359.9999, list: WIND_LIST_ID,
        hint: "Pick a compass point or type any bearing.",
    });
}

// ---- track ----
function trkRowHTML(idx) {
    const inner = `
        <div class="grid">
            <div class="field">
                <label>Date (local) <span class="req">*</span></label>
                <input type="date" name="trk.${idx}.date" required
                       min="1900-01-01" max="2100-12-31">
                <span class="hint">Carried over when you add the next point.</span>
            </div>
            <div class="field">
                <label>Time (local) <span class="req">*</span></label>
                <input type="time" step="1" name="trk.${idx}.time" required>
                <span class="hint">Combined with the date and timezone offset on export.</span>
            </div>
            ${coord(`trk.${idx}.position.lat`, "Latitude (°)", "lat")}
            ${coord(`trk.${idx}.position.lon`, "Longitude (°)", "lon")}
            ${text(`trk.${idx}.position.position_txt`, "Position text", {
                readOnly: true,
                hint: "Derived from the latitude and longitude.",
            })}
            ${num(`trk.${idx}.distance_nm`, "Distance (nm)", { min: 0, hint: true })}
            ${num(`trk.${idx}.log_nm`,      "Log (nm)",      { min: 0, hint: true })}
            ${num(`trk.${idx}.course_compass_deg`,        "Course compass (°)",        { min: 0, max: 359.9999, hint: true })}
            ${num(`trk.${idx}.course_true_deg`,           "Course true (°)",           { min: 0, max: 359.9999, hint: true })}
            ${num(`trk.${idx}.course_over_ground_deg`,    "Course over ground (°)",    { min: 0, max: 359.9999, hint: true })}
            ${windField(`trk.${idx}.wind_true_deg`, "Wind true (°)")}
            ${num(`trk.${idx}.wind_app_deg`,  "Wind apparent (°)",  { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.speed_kn`,      "Speed (kn)",         { min: 0 })}
        </div>`;
    return rowWrap("Track point", idx, inner,
        '<button type="button" class="calc-btn" title="Fill in the fields this row is missing">🧮 Calculate</button>');
}

// ---------- Dynamic list manager ----------
const lists = {
    mv:  { container: "mvList",  build: mvRowHTML  },
    poi: { container: "poiList", build: poiRowHTML },
    trk: { container: "trkList", build: trkRowHTML },
};

function rebuildList(key) {
    const cfg = lists[key];
    const el = document.getElementById(cfg.container);
    const rows = Array.from(el.querySelectorAll(".row"));
    const values = rows.map(r => collectRow(r));
    // A typed log keeps its manual mark across the re-index, or a row removal
    // would silently turn the teacher's reading back into a derived value.
    const manualLogs = rows.map(r => {
        const log = r.querySelector('[name$=".log_nm"]');
        return !!log && log.dataset.manual === "1";
    });
    el.innerHTML = values.map((_, i) => cfg.build(i)).join("");
    const rebuilt = el.querySelectorAll(".row");
    rows.forEach((_, i) => {
        applyRow(rebuilt[i], values[i]);
        if (manualLogs[i]) {
            const log = rebuilt[i].querySelector('[name$=".log_nm"]');
            if (log) log.dataset.manual = "1";
        }
    });
    if (key === "trk") recomputeTrack();
}

function collectRow(rowEl) {
    const out = {};
    rowEl.querySelectorAll("input, textarea, select").forEach(inp => {
        out[inp.name] = inp.value;
    });
    return out;
}
function applyRow(rowEl, values) {
    rowEl.querySelectorAll("input, textarea, select").forEach(inp => {
        const matchKey = Object.keys(values).find(k => k.replace(/\.\d+\./, ".X.") === inp.name.replace(/\.\d+\./, ".X."));
        if (matchKey !== undefined) inp.value = values[matchKey];
    });
}

function addRow(key) {
    const cfg = lists[key];
    const el = document.getElementById(cfg.container);
    const idx = el.querySelectorAll(".row").length;
    el.insertAdjacentHTML("beforeend", cfg.build(idx));
    // A passage usually runs through one day, so a new point inherits the
    // previous point's date. The time is deliberately left blank: a guessed
    // time would look filled in and quietly skew every elapsed-time leg.
    if (key === "trk" && idx > 0) {
        const previous = val(`trk.${idx - 1}.date`);
        const input = el.querySelector(`[name="trk.${idx}.date"]`);
        if (previous && input) input.value = previous;
    }
}

document.querySelectorAll("button[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
        addRow(btn.dataset.add);
        if (btn.dataset.add === "trk") recomputeTrack();
    });
});

document.body.addEventListener("click", e => {
    if (!e.target.classList.contains("remove-btn")) return;
    const row = e.target.closest(".row");
    const list = row.parentElement;
    row.remove();
    // re-index sibling rows so names stay sequential
    const key = Object.keys(lists).find(k => lists[k].container === list.id);
    if (key) rebuildList(key);
});

// ---------- Timezone dropdown → auto-fill UTC offset ----------
function populateTimezones() {
    const sel = document.getElementById("tzSelect");
    const off = document.getElementById("tzOffset");
    if (!sel) return;

    // Group entries into <optgroup>s, preserving list order.
    const groups = new Map();
    TIMEZONES.forEach((tz, i) => {
        if (!groups.has(tz.group)) groups.set(tz.group, []);
        groups.get(tz.group).push({ ...tz, i });
    });
    for (const [groupLabel, entries] of groups) {
        const og = document.createElement("optgroup");
        og.label = groupLabel;
        entries.forEach(tz => {
            const opt = document.createElement("option");
            opt.value = String(tz.i);          // index into TIMEZONES (name alone isn't unique)
            opt.textContent = tz.label;
            opt.dataset.name = tz.name;
            opt.dataset.offset = tz.offset;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    }

    sel.addEventListener("change", () => {
        const opt = sel.selectedOptions[0];
        if (opt && opt.dataset.offset && off) off.value = opt.dataset.offset;
    });
}
populateTimezones();

// ---------- Track log auto-fill ----------
// The "log" is the running cumulative distance sailed. The first track point
// has distance 0 (nothing travelled yet) and its log is the editable starting
// reading. Every later point's log is derived as previous log + its distance,
// and shown read-only. Recompute cascades so editing any earlier distance
// updates all following logs.
function nm4(x) {
    return roundTo(x, 4); // keep to the schema's 0.0001 precision
}

function recomputeLogs() {
    const rows = document.querySelectorAll("#trkList .row");
    let prevLog = 0;
    rows.forEach((row, i) => {
        const dist = row.querySelector(`[name="trk.${i}.distance_nm"]`);
        const log  = row.querySelector(`[name="trk.${i}.log_nm"]`);
        if (!dist || !log) return;

        if (i === 0) {
            // start point: distance fixed at 0; log is the base reading
            dist.value = "0";
            dist.readOnly = true;
            const base = parseFloat(log.value);
            prevLog = Number.isFinite(base) ? base : 0;
            return;
        }
        if (log.dataset.manual === "1") {
            // The teacher has a real log reading for this row; hers wins, and the
            // calculator uses it as a distance source.
            const typed = parseFloat(log.value);
            if (Number.isFinite(typed)) prevLog = typed;
            return;
        }
        const d = parseFloat(dist.value);
        if (Number.isFinite(d)) {
            prevLog = nm4(prevLog + d);
            log.value = String(prevLog);
        } else {
            log.value = ""; // distance not entered yet → leave the log blank
        }
    });
}

// ---------- Track position text auto-fill ----------
// Position text only ever restates the latitude and longitude above it, so it
// is derived rather than typed: the input is read-only and refilled whenever
// either coordinate changes. A half-entered position leaves it blank instead of
// showing a coordinate built around the missing half.
function recomputePositions() {
    document.querySelectorAll("#trkList .row").forEach((row, i) => {
        const txt = row.querySelector(`[name="trk.${i}.position.position_txt"]`);
        if (!txt) return;
        const lat = coordValue(row.querySelector(`[name="trk.${i}.position.lat"]`));
        const lon = coordValue(row.querySelector(`[name="trk.${i}.position.lon"]`));
        txt.value = formatPositionText(lat, lon);
    });
}

// Every derived field of the track, refreshed together. Rows are added, removed
// and re-indexed from several places; they all go through here.
function recomputeTrack() {
    recomputeLogs();
    recomputePositions();
}

// ---------- The calculator button ----------
// Whatever is filled is input, whatever is blank is output. A field that already
// has a value is never overwritten; if the computed value disagrees beyond
// tolerance the row says so and keeps the teacher's number.
const TOLERANCE = { angle: 0.05, distance: 0.05, coord: 0.0002, text: 0 };
const COURSE_FIELDS = { compass: "course_compass_deg", true: "course_true_deg", cog: "course_over_ground_deg" };
const COURSE_ORDER = ["compass", "true", "cog"];

function hintOf(input) {
    const field = input.closest(".field");
    return field ? field.querySelector(".hint") : null;
}

function setHint(hint, text, kind) {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.toggle("filled", kind === "filled");
    hint.classList.toggle("warn", kind === "warn");
    hint.classList.remove("err"); // a calculator message must replace a stale coordinate error, not sit under it
}

function disagrees(currentText, target) {
    if (target.kind === "text") return currentText !== String(target.value);
    const current = parseFloat(currentText);
    if (!Number.isFinite(current)) return false;
    const diff = target.kind === "angle"
        ? Math.abs(CourseChain.normalize180(current - target.value))
        : Math.abs(current - target.value);
    return diff > TOLERANCE[target.kind];
}

/**
 * @param {Array} targets each {input, kind, value, source, missing, title, warn}
 * @returns {{filled:number, flagged:number, missing:string[]}}
 */
function applyTargets(targets) {
    let filled = 0;
    let flagged = 0;
    const missing = [];

    targets.forEach(t => {
        const hint = hintOf(t.input);
        const current = t.input.value.trim();
        if (t.title) t.input.title = t.title;

        const unavailable = t.value === undefined || t.value === null ||
            (typeof t.value === "number" && !Number.isFinite(t.value));
        if (unavailable) {
            if (t.missing) missing.push(t.missing);
            if (current === "" && t.missing) setHint(hint, `needs ${t.missing}`, "warn");
            else setHint(hint, "", null);
            return;
        }

        const text = typeof t.value === "number" ? String(nm4(t.value)) : String(t.value);
        if (current === "") {
            t.input.value = text;
            filled++;
            setHint(hint, `from ${t.source}`, "filled");
        } else if (disagrees(current, t)) {
            flagged++;
            setHint(hint, `${t.source} gives ${text} — kept your ${current}`, "warn");
        } else {
            setHint(hint, "", null);
        }

        if (t.warn) {
            flagged++;
            const existing = hint ? hint.textContent : "";
            setHint(hint, [existing, t.warn].filter(Boolean).join(" · "), "warn");
        }
    });

    return { filled, flagged, missing };
}

// The three courses solve from whichever one is filled, in compass → true → COG
// order. Any other filled course becomes a cross-check rather than an input.
function courseTargets(i, row) {
    const inputs = {};
    for (const [key, suffix] of Object.entries(COURSE_FIELDS)) {
        const el = row.querySelector(`[name="trk.${i}.${suffix}"]`);
        if (!el) return [];
        inputs[key] = el;
    }

    const anchor = COURSE_ORDER.find(k => inputs[k].value.trim() !== "");
    if (!anchor) {
        return COURSE_ORDER.map(key => ({
            input: inputs[key], kind: "angle", value: undefined,
            missing: "one of the three courses",
        }));
    }

    const value = parseFloat(inputs[anchor].value);
    const ctx = rowCtx(i);
    const result = anchor === "compass" ? CourseChain.forward(value, ctx)
                 : anchor === "true"    ? CourseChain.solveFromTrue(value, ctx)
                 :                        CourseChain.solveFromCOG(value, ctx);
    const derived = { compass: result.compass, true: result.trueDeg, cog: result.cog };
    const missing = (result.missing || []).join(", ");
    const title = (result.steps || []).join("\n");

    return COURSE_ORDER.filter(key => key !== anchor).map(key => ({
        input: inputs[key], kind: "angle", value: derived[key],
        source: "the course chain", title: title,
        missing: missing || "more input",
    }));
}

const DISTANCE_SOURCE = {
    log: "the log difference",
    "speed-time": "speed × time",
    positions: "the plotted positions",
};

/** A log reading only counts as input if the teacher typed it. */
function manualLog(i) {
    const el = document.querySelector(`[name="trk.${i}.log_nm"]`);
    if (!el || el.dataset.manual !== "1") return undefined;
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : undefined;
}

// Row i's distance is the leg arriving at it, sailed at row i-1's speed along
// row i-1's COG. Row 0 has no incoming leg.
function legTargets(i, row) {
    if (i === 0) return [];
    const distInput = row.querySelector(`[name="trk.${i}.distance_nm"]`);
    const logInput  = row.querySelector(`[name="trk.${i}.log_nm"]`);
    const latInput  = row.querySelector(`[name="trk.${i}.position.lat"]`);
    const lonInput  = row.querySelector(`[name="trk.${i}.position.lon"]`);
    if (!distInput || !logInput) return [];

    const logPrev = manualLog(i - 1);
    const options = CourseChain.legDistances({
        logPrev:   logPrev,
        logThis:   manualLog(i),
        speedPrev: val(`trk.${i - 1}.speed_kn`, { number: true }),
        hours:     CourseChain.hoursBetween(localTimeOf(i - 1), localTimeOf(i)),
        posPrev:   positionOf(i - 1),
        posThis:   positionOf(i),
    });
    const winner = options[0];
    const targets = [];

    // A second source that disagrees with the one used means one of them is wrong.
    const conflicts = winner
        ? options.slice(1).filter(o => Math.abs(o.nm - winner.nm) > TOLERANCE.distance)
        : [];

    targets.push({
        input: distInput, kind: "distance",
        value: winner ? winner.nm : undefined,
        source: winner ? DISTANCE_SOURCE[winner.source] : undefined,
        missing: "two typed logs, a previous speed with both times, or two positions",
        title: options.map(o => `${o.nm} nm from ${DISTANCE_SOURCE[o.source]}`).join("\n"),
        warn: conflicts.length
            ? `but ${conflicts.map(o => `${DISTANCE_SOURCE[o.source]} gives ${o.nm}`).join(" and ")}`
            : undefined,
    });

    targets.push(Number.isFinite(logPrev) && winner
        ? {
            input: logInput, kind: "distance",
            value: CourseChain.round4(logPrev + winner.nm),
            source: `the previous log plus ${winner.nm} nm`,
        }
        : {
            input: logInput, kind: "distance", value: undefined,
            missing: "a typed log on the previous point and this leg's distance",
        });

    const prevPos = positionOf(i - 1);
    const prevCog = val(`trk.${i - 1}.course_over_ground_deg`, { number: true });
    const dr = (prevPos && Number.isFinite(prevCog) && winner)
        ? CourseChain.positionFrom(prevPos.lat, prevPos.lon, prevCog, winner.nm)
        : null;
    const drMissing = "the previous position, its course over ground, and this leg's distance";
    if (latInput) {
        targets.push({
            input: latInput, kind: "coord", value: dr ? dr.lat : undefined,
            source: `dead reckoning from track point ${i}`, missing: drMissing,
        });
    }
    if (lonInput) {
        targets.push({
            input: lonInput, kind: "coord", value: dr ? dr.lon : undefined,
            source: `dead reckoning from track point ${i}`, missing: drMissing,
        });
    }

    return targets;
}

function showRowSummary(row, outcome) {
    const el = row.querySelector(".calc-summary");
    if (!el) return;
    const parts = [outcome.filled === 1 ? "filled 1 field" : `filled ${outcome.filled} fields`];
    if (outcome.flagged) {
        parts.push(outcome.flagged === 1 ? "1 disagreement flagged" : `${outcome.flagged} disagreements flagged`);
    }
    const needs = Array.from(new Set(outcome.missing));
    if (needs.length) parts.push(`still needs ${needs.join("; ")}`);
    el.textContent = parts.join(" · ");
    el.hidden = false;
    el.classList.toggle("warn", outcome.flagged > 0 || needs.length > 0);
}

// Two passes, because the second depends on what the first wrote: the leg fills the
// position, and the variation lookup reads it. (Position text needs no pass of its
// own — recomputePositions derives it from lat/lon the moment they change.)
function calcRow(i) {
    const row = document.querySelectorAll("#trkList .row")[i];
    if (!row) return;
    const first = applyTargets(legTargets(i, row));
    const second = applyTargets(courseTargets(i, row));
    showRowSummary(row, {
        filled:  first.filled + second.filled,
        flagged: first.flagged + second.flagged,
        missing: [...first.missing, ...second.missing],
    });
    recomputeTrack();   // the distance feeds the derived logs, the DR position the text
}

document.body.addEventListener("click", e => {
    if (!e.target.classList.contains("calc-btn")) return;
    const rows = Array.from(document.querySelectorAll("#trkList .row"));
    const i = rows.indexOf(e.target.closest(".row"));
    if (i >= 0) calcRow(i);
});

// A log the teacher types is hers: it stops being derived from the distances and
// becomes a distance source for the calculator instead. Any distance edit (or the
// start point's log) re-derives the cumulative logs; a coordinate edit re-derives
// that row's position text.
document.body.addEventListener("input", e => {
    const name = e.target.name || "";
    if (/^trk\.\d+\.log_nm$/.test(name)) e.target.dataset.manual = "1";
    if (/^trk\.\d+\.(distance_nm|log_nm)$/.test(name)) recomputeLogs();
    if (/^trk\.\d+\.position\.(lat|lon)$/.test(name)) recomputePositions();
});

// ---------- Coordinate fields: normalise on blur ----------
// Valid text is rewritten as canonical decimal (what the JSON stores); invalid
// text stays exactly as typed — a rejected value the teacher can still see is
// one she can fix — with the reason on the field's hint line. Only hints this
// path wrote (.err) are cleared on success, so the calculator's "from …"
// provenance notes survive a mere blur.
function normalizeCoordInput(input) {
    const hint = hintOf(input);
    const res = parseLatLon(input.value, input.dataset.coord);
    if (res.ok) {
        if (res.value !== undefined) input.value = String(res.value);
        else if (input.value !== "") input.value = ""; // whitespace-only normalises to truly empty
        input.classList.remove("invalid");
        if (hint && hint.classList.contains("err")) {
            hint.textContent = "";
            hint.classList.remove("err");
        }
        return true;
    }
    input.classList.add("invalid");
    if (hint) {
        hint.textContent = res.error;
        hint.classList.remove("filled", "warn");
        hint.classList.add("err");
    }
    return false;
}

document.body.addEventListener("focusout", e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.coord) return;
    normalizeCoordInput(input);
    // Rewriting the value programmatically fires no input event, so the
    // derived position text is refreshed here.
    if (/^trk\./.test(input.name || "")) recomputePositions();
});

// initial seed: leeway (fixed 4) + one row each for required arrays
document.body.insertAdjacentHTML("beforeend", windDatalistHTML());
document.getElementById("leewayList").innerHTML = leewayHTML();
document.getElementById("cdList").innerHTML = cdCardHTML();
addRow("mv");
// first magnetic-variation entry is the base entry: default lat/lon/range to 0
["lat", "lon", "range_nm"].forEach(f => {
    const el = document.querySelector(`[name="mv.0.${f}"]`);
    if (el) el.value = "0";
});
addRow("poi");
addRow("trk");
recomputeTrack();

// ---------- Build JSON from form ----------
function val(name, { number = false } = {}) {
    const el = document.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!el) return undefined;
    const v = el.value;
    if (v === "") return undefined;
    return number ? Number(v) : v;
}

// composeLocal() already guarantees seconds, so this only bolts the task's
// UTC offset onto the wall-clock string.
function localToIso(local, offset) {
    if (!local) return undefined;
    return `${local}${offset || "Z"}`;
}

// ---------- Form → plain data (shared by the JSON export and the calculator) ----------
function readCard() {
    return CD_HEADINGS
        .map((heading, i) => ({
            heading_deg:   heading,
            deviation_deg: val(`cd.${i}.deviation_deg`, { number: true }),
        }))
        .filter(cell => cell.deviation_deg !== undefined);
}

// Annual change is entered in minutes and stored in degrees; converting here is
// what keeps that conversion in one place, since buildJSON calls this too.
function readMvList() {
    const rows = document.querySelectorAll("#mvList .row");
    return Array.from(rows).map((_, i) => {
        const annualChangeMin = val(`mv.${i}.annual_change_min`, { number: true });
        return {
            base_deg:          val(`mv.${i}.base_deg`,  { number: true }),
            base_year:         val(`mv.${i}.base_year`, { number: true }),
            annual_change_deg: annualChangeMin === undefined
                ? undefined
                : nm4(minutesToDegrees(annualChangeMin)),
            lat:               val(`mv.${i}.lat`,       { number: true }),
            lon:               val(`mv.${i}.lon`,       { number: true }),
            range_nm:          val(`mv.${i}.range_nm`,  { number: true }),
        };
    });
}

function readLeewayTable() {
    const table = {};
    POINTS_OF_SAIL.forEach(p => {
        table[p.key] = {
            range: {
                min_deg: val(`lw.${p.key}.min_deg`, { number: true }),
                max_deg: val(`lw.${p.key}.max_deg`, { number: true }),
            },
            value_deg: val(`lw.${p.key}.value_deg`, { number: true }),
        };
    });
    return table;
}

/** A coordinate input's current value, or NaN while blank/invalid/mid-edit. */
function coordValue(input) {
    if (!input) return NaN;
    const res = parseLatLon(input.value, input.dataset.coord);
    return res.ok && res.value !== undefined ? res.value : NaN;
}

function positionOf(i) {
    const lat = coordValue(document.querySelector(`[name="trk.${i}.position.lat"]`));
    const lon = coordValue(document.querySelector(`[name="trk.${i}.position.lon"]`));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

// The date and time are separate controls; composeLocal() is the only place
// they are joined, and it yields undefined until both are filled in.
function localTimeOf(i) {
    return composeLocal(val(`trk.${i}.date`), val(`trk.${i}.time`));
}

// Everything the course chain needs to work on one track row.
function rowCtx(i) {
    const wind = val(`trk.${i}.wind_true_deg`, { number: true });
    const date = val(`trk.${i}.date`);
    const pos = positionOf(i);
    return {
        card:        readCard(),
        mvList:      readMvList(),
        leewayTable: readLeewayTable(),
        windTrueDeg: wind === undefined ? NaN : wind,
        lat:         pos ? pos.lat : NaN,
        lon:         pos ? pos.lon : NaN,
        year:        date ? Number(date.slice(0, 4)) : NaN,
    };
}

const CHART_FIELDS = [
    "chart.file_name",
    "chart.bounds.north_lat_deg", "chart.bounds.south_lat_deg",
    "chart.bounds.west_lon_deg",  "chart.bounds.east_lon_deg",
    "chart.margins.top", "chart.margins.bottom",
    "chart.margins.left", "chart.margins.right",
];

function hasChartData() {
    return CHART_FIELDS.some(name => {
        const el = document.querySelector(`[name="${CSS.escape(name)}"]`);
        return el && el.value.trim() !== "";
    });
}

function withChartSuffix(filename) {
    const lower = filename.toLowerCase();
    const ext = lower.endsWith(".json") ? ".json" : "";
    const stem = ext ? filename.slice(0, -ext.length) : filename;
    if (stem.toLowerCase().endsWith("_chart")) return filename;
    return `${stem}_chart${ext}`;
}

function buildJSON() {
    const tzOffset = val("tz.offset");
    const tzName = document.getElementById("tzSelect")?.selectedOptions[0]?.dataset.name;

    const magnetic_variation_list = readMvList();
    const compass_deviation_table = readCard();
    const leeway = readLeewayTable();

    const poiRows = document.querySelectorAll("#poiList .row");
    const poi = Array.from(poiRows).map((_, i) => ({
        id:          `poi-${i + 1}`,
        name:        val(`poi.${i}.name`),
        type:        val(`poi.${i}.type`),
        description: val(`poi.${i}.description`) ?? "",
        lat:         val(`poi.${i}.lat`, { number: true }),
        lon:         val(`poi.${i}.lon`, { number: true }),
    }));

    const trkRows = document.querySelectorAll("#trkList .row");
    const trk = Array.from(trkRows).map((_, i) => ({
        id:   `trk-${i + 1}`,
        time: localToIso(localTimeOf(i), tzOffset),
        position: {
            lat:          val(`trk.${i}.position.lat`, { number: true }),
            lon:          val(`trk.${i}.position.lon`, { number: true }),
            position_txt: val(`trk.${i}.position.position_txt`) ?? "",
        },
        distance_nm:            val(`trk.${i}.distance_nm`,            { number: true }),
        log_nm:                 val(`trk.${i}.log_nm`,                 { number: true }),
        course_compass_deg:     val(`trk.${i}.course_compass_deg`,     { number: true }),
        course_true_deg:        val(`trk.${i}.course_true_deg`,        { number: true }),
        course_over_ground_deg: val(`trk.${i}.course_over_ground_deg`, { number: true }),
        wind_true_deg:          val(`trk.${i}.wind_true_deg`,          { number: true }),
        wind_app_deg:           val(`trk.${i}.wind_app_deg`,           { number: true }),
        speed_kn:               val(`trk.${i}.speed_kn`,               { number: true }),
    }));

    const commentRaw = val("solution.comment");
    const comment = commentRaw === undefined ? null : commentRaw;

    const task = {
        meta: {
            title:       val("meta.title"),
            desc:        val("meta.desc"),
            author:      val("meta.author"),
            content_md:  val("meta.content_md") ?? "",
        },
        navigation: {
            timezone: { name: tzName, offset: tzOffset },
            magnetic_variation_list,
            compass_deviation_table,
            leeway,
        },
    };

    if (hasChartData()) {
        task.chart = {
            file_name: val("chart.file_name"),
            bounds: {
                north_lat_deg: val("chart.bounds.north_lat_deg", { number: true }),
                south_lat_deg: val("chart.bounds.south_lat_deg", { number: true }),
                west_lon_deg:  val("chart.bounds.west_lon_deg",  { number: true }),
                east_lon_deg:  val("chart.bounds.east_lon_deg",  { number: true }),
            },
            margins: {
                top:    val("chart.margins.top",    { number: true }),
                bottom: val("chart.margins.bottom", { number: true }),
                left:   val("chart.margins.left",   { number: true }),
                right:  val("chart.margins.right",  { number: true }),
            },
        };
    }

    return {
        task,
        poi,
        solution: { trk, comment },
    };
}

// ---------- Validate + download ----------
function showStatus(html, kind) {
    const el = document.getElementById("status");
    el.className = kind;
    el.innerHTML = html;
}

function downloadJSON(obj, filename) {
    // DokumentacjaJSON_v1.docx section 3: 4 decimal places, fractions padded,
    // integers bare — JSON.stringify cannot express that.
    const blob = new Blob([TaskJSON.formatTaskJSON(obj)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
}

// The Dead Reckoning calculator (and the other three) now live in the shared
// right-side calculator sidebar, powered by the calculator cores/adapters
// (window.DR/Fix/RunFix/TravPOI + *_enhanced.js) loaded in the template. The
// form's earlier private DR reimplementation was removed to avoid two click
// handlers fighting over #drCalcBtn.

async function copyToClipboard(text, btn) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); ta.remove();
    }
    const original = btn.textContent;
    btn.textContent = "✓ Copied";
    btn.classList.add("copied");
    setTimeout(() => { btn.textContent = original; btn.classList.remove("copied"); }, 1500);
}

// ---------- Universal coordinate format converter (DMS · DMM → decimal degrees) ----------
// Matches one coordinate. Degrees + minutes are mandatory (this is the "conversion" job);
// seconds and hemisphere are optional. Plain decimal input is rejected as a no-op.
// Examples accepted: 54°7.071'N, 54°7'4.26"N, -54°7'4.26", 54 7 4.26 N
const COORD_PATTERN = /(?<![\d.])([+-]?\d+(?:\.\d+)?)\s*°?\s*(\d+(?:\.\d+)?)\s*['′](?:\s*(\d+(?:\.\d+)?)\s*(?:"|″|''))?\s*([NSEWnsew])?/g;

function parseCoordinates(input) {
    // A decimal comma ("54°7,071'N") is only a decimal when digits follow it up
    // to a minute/second mark; a comma separating a pair ("…'N,18°…") is not.
    // Without this, the pattern matched the fragment after the comma and
    // produced a silently wrong number, not a rejection.
    input = input.replace(/(?<=\d),(?=\d+\s*['′"″])/g, ".");
    const matches = [...input.matchAll(COORD_PATTERN)].filter(m => m[0].trim() !== "");
    if (matches.length === 0) {
        if (/\d/.test(input)) {
            throw new Error("Decimal degrees don't need conversion. Use DMS (54°7'4.26\"N) or DMM (54°7.071'N).");
        }
        throw new Error("No coordinate found. Try e.g. 54°7'4.26\"N or 54°7.071'N.");
    }
    if (matches.length > 2) {
        throw new Error(`Expected one or two coordinates, found ${matches.length}.`);
    }

    const parsed = matches.map(m => {
        const degRaw = parseFloat(m[1]);
        const min = parseFloat(m[2]);
        const sec = m[3] !== undefined ? parseFloat(m[3]) : 0;
        const hemi = m[4] ? m[4].toUpperCase() : null;

        if (min < 0 || min >= 60) throw new Error(`Minutes out of range 0…60 (got ${min}).`);
        if (sec < 0 || sec >= 60) throw new Error(`Seconds out of range 0…60 (got ${sec}).`);

        let sign = degRaw < 0 ? -1 : 1;
        const absDeg = Math.abs(degRaw);
        let decimal = sign * (absDeg + min / 60 + sec / 3600);
        if (hemi === "S" || hemi === "W") decimal = -Math.abs(decimal);
        else if (hemi === "N" || hemi === "E") decimal = Math.abs(decimal);

        const isLat = hemi ? (hemi === "N" || hemi === "S") : null;
        return { decimal, isLat, hemi };
    });

    function checkLat(v) {
        if (v < -90 || v > 90) throw new Error("Latitude out of range -90…90.");
    }
    function checkLon(v) {
        if (v < -180 || v > 180) throw new Error("Longitude out of range -180…180.");
    }

    if (parsed.length === 1) {
        const p = parsed[0];
        if (p.isLat === true) checkLat(p.decimal);
        else if (p.isLat === false) checkLon(p.decimal);
        else if (p.decimal < -90 || p.decimal > 90) checkLon(p.decimal);
        return { single: p };
    }

    // Pair: prefer hemispheres; otherwise assume order is lat, lon.
    let lat, lon;
    const withHemi = parsed.filter(p => p.isLat !== null);
    if (withHemi.length === 2) {
        lat = parsed.find(p => p.isLat === true);
        lon = parsed.find(p => p.isLat === false);
        if (!lat || !lon) throw new Error("Pair must have one N/S and one E/W coordinate.");
    } else if (withHemi.length === 0) {
        [lat, lon] = parsed;
    } else {
        throw new Error("Mixed input: give a hemisphere on both coordinates or on neither.");
    }
    checkLat(lat.decimal);
    checkLon(lon.decimal);
    return { lat: lat.decimal, lon: lon.decimal };
}

let lastCC = null;

function showCCError(msg) {
    const el = document.getElementById("ccResult");
    el.className = "dr-result show err";
    el.textContent = "⚠ " + msg;
    document.getElementById("ccCopyBtn").disabled = true;
    lastCC = null;
}

document.getElementById("ccConvertBtn")?.addEventListener("click", () => {
    const raw = document.getElementById("ccInput").value.trim();
    if (!raw) return showCCError("Enter a coordinate.");
    try {
        const result = parseCoordinates(raw);
        const el = document.getElementById("ccResult");
        el.className = "dr-result show";
        const text = result.single
            ? `${result.single.decimal.toFixed(4)}°`
            : `${result.lat.toFixed(4)}°, ${result.lon.toFixed(4)}°`;
        el.textContent = text;
        lastCC = { text };
        document.getElementById("ccCopyBtn").disabled = false;
    } catch (err) {
        showCCError(err.message);
    }
});

document.getElementById("ccCopyBtn")?.addEventListener("click", e => {
    if (!lastCC) return;
    copyToClipboard(lastCC.text, e.currentTarget);
});

document.getElementById("validateBtn").addEventListener("click", () => {
    // Normalise every coordinate field first: the teacher may click Validate
    // without ever leaving the field she just typed in, and focusout order is
    // not something an export should depend on.
    const bad = [];
    document.querySelectorAll("input[data-coord]").forEach(input => {
        if (!normalizeCoordInput(input)) bad.push(input.name);
    });
    recomputeTrack();
    if (bad.length) {
        const items = bad.map(n => `<li><code class="path">${n}</code></li>`).join("");
        showStatus(`<strong>${bad.length} coordinate field(s) need fixing before export:</strong><ul>${items}</ul>`, "err");
        return;
    }
    const data = buildJSON();
    const ok = validate(data);
    if (ok) {
        let name = document.getElementById("downloadName").value.trim() || "navigation-task.json";
        if (data.task.chart) name = withChartSuffix(name);
        downloadJSON(data, name);
        showStatus(`✓ Valid against schema. Downloaded as <code>${name}</code>.`, "ok");
    } else {
        const items = (validate.errors || []).map(err => {
            const path = err.instancePath || "(root)";
            return `<li><code class="path">${path}</code> ${err.message}` +
                (err.params && Object.keys(err.params).length
                    ? ` <span style="color:#6b7280">(${JSON.stringify(err.params)})</span>` : "") +
                `</li>`;
        }).join("");
        showStatus(`<strong>Validation failed — ${validate.errors.length} error(s):</strong><ul>${items}</ul>`, "err");
    }
});
