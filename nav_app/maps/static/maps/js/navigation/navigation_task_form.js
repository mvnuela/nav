import Ajv2020 from "https://esm.sh/ajv@8.17.1/dist/2020.js";

const schema = JSON.parse(document.getElementById("ntSchema").textContent);
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const POINTS_OF_SAIL = [
    { key: "close_hauled", label: "Close hauled" },
    { key: "beam_reach",   label: "Beam reach" },
    { key: "broad_reach",  label: "Broad reach" },
    { key: "running",      label: "Running" },
];

// Hardcoded timezone list feeding the #tzSelect dropdown. Selecting an entry
// auto-fills the #tzOffset field with `offset`. Zones that observe DST appear
// twice (winter/summer) so the teacher can pick the offset matching the task
// dates; the offset field stays editable for any manual correction.
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
function num(name, label, opts = {}) {
    const { step = "0.0001", min, max, required = true } = opts;
    const attrs = [
        `type="number"`, `step="${step}"`, `name="${name}"`,
        min !== undefined ? `min="${min}"` : "",
        max !== undefined ? `max="${max}"` : "",
        required ? "required" : "",
    ].filter(Boolean).join(" ");
    return `
        <div class="field">
            <label>${label}${required ? ' <span class="req">*</span>' : ""}</label>
            <input ${attrs}>
        </div>`;
}

function text(name, label, { required = true, placeholder = "" } = {}) {
    return `
        <div class="field">
            <label>${label}${required ? ' <span class="req">*</span>' : ""}</label>
            <input type="text" name="${name}"${required ? " required" : ""}${placeholder ? ` placeholder="${placeholder}"` : ""}>
        </div>`;
}

function rowWrap(title, idx, inner) {
    return `
        <div class="row" data-idx="${idx}">
            <div class="row-title">
                <span>${title} #${idx + 1}</span>
                <button type="button" class="remove-btn">Remove</button>
            </div>
            ${inner}
        </div>`;
}

// ---- magnetic variation ----
function mvRowHTML(idx) {
    const inner = `
        <div class="grid">
            ${num(`mv.${idx}.base_deg`,         "Base variation (°)")}
            ${num(`mv.${idx}.base_year`,        "Base year", { step: "1", min: 1900, max: 2100 })}
            ${num(`mv.${idx}.annual_change_deg`,"Annual change (°)")}
            ${num(`mv.${idx}.lat`,              "Latitude (°)",  { min: -90,  max: 90 })}
            ${num(`mv.${idx}.lon`,              "Longitude (°)", { min: -180, max: 180 })}
            ${num(`mv.${idx}.range_nm`,         "Range (nm)",    { min: 0 })}
        </div>`;
    return rowWrap("Variation", idx, inner);
}

// ---- compass deviation ----
function cdRowHTML(idx) {
    const inner = `
        <div class="grid">
            ${num(`cd.${idx}.heading_deg`,   "Heading (°)",   { min: 0, max: 359.9999 })}
            ${num(`cd.${idx}.deviation_deg`, "Deviation (°)")}
        </div>`;
    return rowWrap("Heading", idx, inner);
}

// ---- leeway: 4 fixed entries, not dynamic ----
function leewayHTML() {
    return POINTS_OF_SAIL.map((p, i) => `
        <div class="row" data-pos="${p.key}">
            <div class="row-title"><span>${p.label}</span></div>
            <div class="grid">
                ${num(`lw.${p.key}.min_deg`,   "Min angle (°)",  { min: 0, max: 359.9999 })}
                ${num(`lw.${p.key}.max_deg`,   "Max angle (°)",  { min: 0, max: 359.9999 })}
                ${num(`lw.${p.key}.value_deg`, "Leeway value (°)")}
            </div>
        </div>`).join("");
}

// ---- POI ----
function poiRowHTML(idx) {
    const inner = `
        <div class="grid">
            ${text(`poi.${idx}.name`, "Name")}
            ${text(`poi.${idx}.type`, "Type", { placeholder: "buoy / lighthouse / ..." })}
            ${num(`poi.${idx}.lat`, "Latitude (°)",  { min: -90,  max: 90 })}
            ${num(`poi.${idx}.lon`, "Longitude (°)", { min: -180, max: 180 })}
        </div>
        <div class="field" style="margin-top:8px">
            <label>Description</label>
            <textarea name="poi.${idx}.description" rows="2"></textarea>
        </div>`;
    return rowWrap("POI", idx, inner);
}

// ---- track ----
function trkRowHTML(idx) {
    const inner = `
        <div class="grid">
            <div class="field">
                <label>Time (local) <span class="req">*</span></label>
                <input type="datetime-local" step="1" name="trk.${idx}.time" required>
                <span class="hint">Combined with timezone offset on export.</span>
            </div>
            ${num(`trk.${idx}.position.lat`, "Latitude (°)",  { min: -90,  max: 90 })}
            ${num(`trk.${idx}.position.lon`, "Longitude (°)", { min: -180, max: 180 })}
            ${text(`trk.${idx}.position.position_txt`, "Position text", { placeholder: "54°30'N 18°30'E" })}
            ${num(`trk.${idx}.distance_nm`, "Distance (nm)", { min: 0 })}
            ${num(`trk.${idx}.log_nm`,      "Log (nm)",      { min: 0 })}
            ${num(`trk.${idx}.course_compass_deg`,        "Course compass (°)",        { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.course_true_deg`,           "Course true (°)",           { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.course_over_ground_deg`,    "Course over ground (°)",    { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.wind_true_deg`, "Wind true (°)",      { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.wind_app_deg`,  "Wind apparent (°)",  { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.speed_kn`,      "Speed (kn)",         { min: 0 })}
        </div>`;
    return rowWrap("Track point", idx, inner);
}

// ---------- Dynamic list manager ----------
const lists = {
    mv:  { container: "mvList",  build: mvRowHTML  },
    cd:  { container: "cdList",  build: cdRowHTML  },
    poi: { container: "poiList", build: poiRowHTML },
    trk: { container: "trkList", build: trkRowHTML },
};

function rebuildList(key) {
    const cfg = lists[key];
    const el = document.getElementById(cfg.container);
    const rows = Array.from(el.querySelectorAll(".row"));
    const values = rows.map(r => collectRow(r));
    el.innerHTML = values.map((_, i) => cfg.build(i)).join("");
    rows.forEach((_, i) => applyRow(el.querySelectorAll(".row")[i], values[i]));
}

function collectRow(rowEl) {
    const out = {};
    rowEl.querySelectorAll("input, textarea").forEach(inp => {
        out[inp.name] = inp.value;
    });
    return out;
}
function applyRow(rowEl, values) {
    rowEl.querySelectorAll("input, textarea").forEach(inp => {
        const matchKey = Object.keys(values).find(k => k.replace(/\.\d+\./, ".X.") === inp.name.replace(/\.\d+\./, ".X."));
        if (matchKey !== undefined) inp.value = values[matchKey];
    });
}

function addRow(key) {
    const cfg = lists[key];
    const el = document.getElementById(cfg.container);
    const idx = el.querySelectorAll(".row").length;
    el.insertAdjacentHTML("beforeend", cfg.build(idx));
}

document.querySelectorAll("button[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addRow(btn.dataset.add));
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

// initial seed: leeway (fixed 4) + one row each for required arrays
document.getElementById("leewayList").innerHTML = leewayHTML();
addRow("mv");
addRow("cd");
addRow("poi");
addRow("trk");

// ---------- Build JSON from form ----------
function val(name, { number = false } = {}) {
    const el = document.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!el) return undefined;
    const v = el.value;
    if (v === "") return undefined;
    return number ? Number(v) : v;
}

function localToIso(local, offset) {
    // local: "2026-05-12T14:30" or "2026-05-12T14:30:00"
    if (!local) return undefined;
    const withSeconds = local.length === 16 ? local + ":00" : local;
    return `${withSeconds}${offset || "Z"}`;
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

    const mvRows = document.querySelectorAll("#mvList .row");
    const magnetic_variation_list = Array.from(mvRows).map((_, i) => ({
        base_deg:          val(`mv.${i}.base_deg`,          { number: true }),
        base_year:         val(`mv.${i}.base_year`,         { number: true }),
        annual_change_deg: val(`mv.${i}.annual_change_deg`, { number: true }),
        lat:               val(`mv.${i}.lat`,               { number: true }),
        lon:               val(`mv.${i}.lon`,               { number: true }),
        range_nm:          val(`mv.${i}.range_nm`,          { number: true }),
    }));

    const cdRows = document.querySelectorAll("#cdList .row");
    const compass_deviation_table = Array.from(cdRows).map((_, i) => ({
        heading_deg:   val(`cd.${i}.heading_deg`,   { number: true }),
        deviation_deg: val(`cd.${i}.deviation_deg`, { number: true }),
    }));

    const leeway = {};
    POINTS_OF_SAIL.forEach(p => {
        leeway[p.key] = {
            range: {
                min_deg: val(`lw.${p.key}.min_deg`, { number: true }),
                max_deg: val(`lw.${p.key}.max_deg`, { number: true }),
            },
            value_deg: val(`lw.${p.key}.value_deg`, { number: true }),
        };
    });

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
        time: localToIso(val(`trk.${i}.time`), tzOffset),
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
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
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
