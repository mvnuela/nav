// The student's solution page: free-form POI and track rows, coordinates
// normalised on blur, and a Download JSON button that validates against the
// lenient student schema first. Unlike the teacher's form there is no
// calculator and no field is required — the schema only insists on row ids,
// which the assembler generates.
//
// Everything below is a plain-script global loaded by the template before this
// deferred module: formatPositionText, parseLatLon, TaskJSON, StudentSolution
// and (vendored, no CDN) window.ajv2020.

const Ajv2020 = window.ajv2020;

const schema = JSON.parse(document.getElementById("studentSchema").textContent);
const context = JSON.parse(document.getElementById("studentContext").textContent);
// multipleOfPrecision: without it Ajv checks multipleOf by exact float division,
// and a legal 4-decimal value like 18.7826 fails (18.7826/0.0001 is 187825.999…).
const ajv = new Ajv2020({ allErrors: true, strict: false, multipleOfPrecision: 6 });
const validate = ajv.compile(schema);

// ---------- Row markup ----------
function hintSpan() {
    return `<span class="hint"></span>`;
}

function text(name, label, { placeholder = "", readOnly = false } = {}) {
    return `
        <div class="field">
            <label>${label}</label>
            <input type="text" name="${name}"${readOnly ? " readonly" : ""}${placeholder ? ` placeholder="${placeholder}"` : ""}>
            ${hintSpan()}
        </div>`;
}

function num(name, label, { min, max, list } = {}) {
    const attrs = [
        `type="number"`, `step="any"`, `name="${name}"`,
        min !== undefined ? `min="${min}"` : "",
        max !== undefined ? `max="${max}"` : "",
        list ? `list="${list}"` : "",
    ].filter(Boolean).join(" ");
    return `
        <div class="field">
            <label>${label}</label>
            <input ${attrs}>
            ${hintSpan()}
        </div>`;
}

// Text, not number: accepts nautical notation ("54°22.5'N", comma decimals) and
// is normalised to decimal degrees on blur. The hint span is where a rejection
// message goes.
const COORD_PLACEHOLDER = { lat: "54.375 or 54°22.5'N", lon: "18.5 or 018°34.2'E" };

function coord(name, label, axis) {
    return `
        <div class="field">
            <label>${label}</label>
            <input type="text" name="${name}" data-coord="${axis}"
                   placeholder="${COORD_PLACEHOLDER[axis]}">
            ${hintSpan()}
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

// Wind true: a number input backed by a datalist of the 16 compass points, so
// the student can pick one or type any bearing. Only the number is exported.
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

function windDatalistHTML() {
    const options = WIND_DIRECTIONS
        .map(w => `<option value="${w.deg}">${w.name}</option>`)
        .join("");
    return `<datalist id="${WIND_LIST_ID}">${options}</datalist>`;
}

function trkRowHTML(idx) {
    const inner = `
        <div class="grid">
            <div class="field">
                <label>Date (local)</label>
                <input type="date" name="trk.${idx}.date" min="1900-01-01" max="2100-12-31">
                <span class="hint">Carried over when you add the next point.</span>
            </div>
            <div class="field">
                <label>Time (local)</label>
                <input type="time" step="1" name="trk.${idx}.time">
                <span class="hint">Needs a date too, or both are left out.</span>
            </div>
            ${coord(`trk.${idx}.position.lat`, "Latitude (°)", "lat")}
            ${coord(`trk.${idx}.position.lon`, "Longitude (°)", "lon")}
            ${text(`trk.${idx}.position.position_txt`, "Position text", { readOnly: true })}
            ${num(`trk.${idx}.distance_nm`, "Distance (nm)", { min: 0 })}
            ${num(`trk.${idx}.log_nm`,      "Log (nm)",      { min: 0 })}
            ${num(`trk.${idx}.course_compass_deg`,     "Course compass (°)",     { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.course_true_deg`,        "Course true (°)",        { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.course_over_ground_deg`, "Course over ground (°)", { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.wind_true_deg`,   "Wind true (°)",            { min: 0, max: 359.9999, list: WIND_LIST_ID })}
            ${num(`trk.${idx}.wind_true_speed`, "Wind true speed (kn)",     { min: 0 })}
            ${num(`trk.${idx}.wind_app_deg`,    "Wind apparent (°)",        { min: 0, max: 359.9999 })}
            ${num(`trk.${idx}.wind_app_speed`,  "Wind apparent speed (kn)", { min: 0 })}
            ${num(`trk.${idx}.speed_kn`,        "Speed (kn)",               { min: 0 })}
        </div>`;
    return rowWrap("Track point", idx, inner);
}

// ---------- Dynamic list manager ----------
const lists = {
    poi: { container: "poiList", build: poiRowHTML },
    trk: { container: "trkList", build: trkRowHTML },
};

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

// Rebuild after a removal so names (and the "#n" titles) stay sequential,
// carrying every typed value across.
function rebuildList(key) {
    const cfg = lists[key];
    const el = document.getElementById(cfg.container);
    const rows = Array.from(el.querySelectorAll(".row"));
    const values = rows.map(r => collectRow(r));
    el.innerHTML = values.map((_, i) => cfg.build(i)).join("");
    const rebuilt = el.querySelectorAll(".row");
    rows.forEach((_, i) => applyRow(rebuilt[i], values[i]));
    if (key === "trk") recomputePositions();
}

function addRow(key) {
    const cfg = lists[key];
    const el = document.getElementById(cfg.container);
    const idx = el.querySelectorAll(".row").length;
    el.insertAdjacentHTML("beforeend", cfg.build(idx));
    // A passage usually runs through one day, so a new point inherits the
    // previous point's date. The time stays blank: a guessed time would look
    // filled in.
    if (key === "trk" && idx > 0) {
        const previous = el.querySelector(`[name="trk.${idx - 1}.date"]`);
        const input = el.querySelector(`[name="trk.${idx}.date"]`);
        if (previous && previous.value && input) input.value = previous.value;
    }
}

document.querySelectorAll("button[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addRow(btn.dataset.add));
});

document.body.addEventListener("click", e => {
    if (!e.target.classList.contains("remove-btn")) return;
    const row = e.target.closest(".row");
    const list = row.parentElement;
    row.remove();
    const key = Object.keys(lists).find(k => lists[k].container === list.id);
    if (key) rebuildList(key);
});

// ---------- Position text ----------
// Position text only restates lat/lon, so it is derived: the input is read-only
// and refilled whenever either coordinate changes. A half-entered position
// leaves it blank.
function coordValue(input) {
    if (!input) return NaN;
    const res = parseLatLon(input.value, input.dataset.coord);
    return res.ok && res.value !== undefined ? res.value : NaN;
}

function recomputePositions() {
    document.querySelectorAll("#trkList .row").forEach((row, i) => {
        const txt = row.querySelector(`[name="trk.${i}.position.position_txt"]`);
        if (!txt) return;
        const lat = coordValue(row.querySelector(`[name="trk.${i}.position.lat"]`));
        const lon = coordValue(row.querySelector(`[name="trk.${i}.position.lon"]`));
        txt.value = formatPositionText(lat, lon);
    });
}

document.body.addEventListener("input", e => {
    if (/^trk\.\d+\.position\.(lat|lon)$/.test(e.target.name || "")) recomputePositions();
});

// ---------- Coordinates: normalise on blur ----------
// Valid text is rewritten as canonical decimal (what the JSON stores); invalid
// text stays as typed, with the reason on the field's hint line.
function hintOf(input) {
    const field = input.closest(".field");
    return field ? field.querySelector(".hint") : null;
}

function normalizeAngleInput(input) {
    const hint = hintOf(input);
    const res = parseLatLon(input.value, input.dataset.coord);
    if (res.ok) {
        if (res.value !== undefined) input.value = String(res.value);
        else if (input.value !== "") input.value = ""; // whitespace-only becomes truly empty
        input.classList.remove("invalid");
        if (hint) {
            hint.textContent = "";
            hint.classList.remove("err");
        }
        return true;
    }
    input.classList.add("invalid");
    if (hint) {
        hint.textContent = res.error;
        hint.classList.add("err");
    }
    return false;
}

document.body.addEventListener("focusout", e => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.coord) return;
    normalizeAngleInput(input);
    // Rewriting the value programmatically fires no input event.
    if (/^trk\./.test(input.name || "")) recomputePositions();
});

document.body.insertAdjacentHTML("beforeend", windDatalistHTML());

// ---------- Download ----------
function showStatus(html, kind) {
    const el = document.getElementById("status");
    el.className = kind;
    el.innerHTML = html;
}

function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function downloadJSON(obj, filename) {
    // 4 decimal places, fractions padded, integers bare — JSON.stringify cannot express that.
    const blob = new Blob([TaskJSON.formatTaskJSON(obj)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
}

// Row element -> the plain-string record the assembler wants ("" = empty).
function poiRecord(row, i) {
    const f = k => row.querySelector(`[name="poi.${i}.${k}"]`).value;
    return { name: f("name"), type: f("type"), lat: f("lat"), lon: f("lon"), description: f("description") };
}

function trkRecord(row, i) {
    const f = k => row.querySelector(`[name="trk.${i}.${k}"]`).value;
    return {
        date: f("date"), time: f("time"),
        lat: f("position.lat"), lon: f("position.lon"), position_txt: f("position.position_txt"),
        distance_nm: f("distance_nm"), log_nm: f("log_nm"),
        course_compass_deg: f("course_compass_deg"), course_true_deg: f("course_true_deg"),
        course_over_ground_deg: f("course_over_ground_deg"),
        wind_true_deg: f("wind_true_deg"), wind_true_speed: f("wind_true_speed"),
        wind_app_deg: f("wind_app_deg"), wind_app_speed: f("wind_app_speed"),
        speed_kn: f("speed_kn"),
    };
}

// Enter in a text field would otherwise submit the form (a GET reload that
// loses everything typed); the only output is the Download button.
document.getElementById("studentForm").addEventListener("submit", e => e.preventDefault());

document.getElementById("downloadBtn").addEventListener("click", () => {
    // Normalise every coordinate first: the student may click Download without
    // ever leaving the field she just typed in.
    const bad = [];
    document.querySelectorAll("input[data-coord]").forEach(input => {
        if (!normalizeAngleInput(input)) bad.push(input.name);
    });
    // A number/date/time input holding unparseable text reports value "" with
    // validity.badInput, so it would silently vanish from the file.
    document.querySelectorAll("#studentForm input").forEach(input => {
        const hint = hintOf(input);
        if (input.validity.badInput) {
            input.classList.add("invalid");
            if (hint) {
                hint.textContent = input.type === "number"
                    ? "Not a number."
                    : "Not a valid " + input.type + ".";
                hint.classList.add("err");
            }
            bad.push(input.name);
        } else if (!input.dataset.coord && input.classList.contains("invalid")) {
            input.classList.remove("invalid");
            if (hint && hint.classList.contains("err")) {
                hint.textContent = "";
                hint.classList.remove("err");
            }
        }
    });
    recomputePositions();
    if (bad.length) {
        const items = bad.map(n => `<li><code class="path">${escapeHTML(n)}</code></li>`).join("");
        showStatus(`<strong>${bad.length} field(s) need fixing before download:</strong><ul>${items}</ul>`, "err");
        return;
    }

    const poiRows = Array.from(document.querySelectorAll("#poiList .row")).map(poiRecord);
    const trkRows = Array.from(document.querySelectorAll("#trkList .row")).map(trkRecord);
    const { data, warnings } = StudentSolution.assembleStudentSolution({
        taskId: context.task_id,
        taskTitle: context.task_title,
        tzOffset: context.tz_offset,
        poiRows, trkRows,
        comment: document.querySelector('[name="solution.comment"]').value,
    });
    const warnHTML = warnings.length
        ? `<ul>${warnings.map(w => `<li>${escapeHTML(w)}</li>`).join("")}</ul>` : "";

    if (validate(data)) {
        const name = StudentSolution.studentFilename(
            document.getElementById("filePrefix").value, context.login, context.task_id);
        downloadJSON(data, name);
        showStatus(`✓ Downloaded as <code>${escapeHTML(name)}</code>.${warnHTML}`, "ok");
    } else {
        const items = (validate.errors || []).map(err => {
            const path = err.instancePath || "(root)";
            return `<li><code class="path">${escapeHTML(path)}</code> ${escapeHTML(err.message)}` +
                (err.params && Object.keys(err.params).length
                    ? ` <span style="color:#6b7280">(${escapeHTML(JSON.stringify(err.params))})</span>` : "") +
                `</li>`;
        }).join("");
        showStatus(`<strong>Validation failed — ${validate.errors.length} error(s):</strong><ul>${items}</ul>${warnHTML}`, "err");
    }
});
