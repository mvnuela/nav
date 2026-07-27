/**
 * Pure navigation maths for the navigation task form's calculator button.
 *
 * Chain:  compass --+deviation--> magnetic --+variation--> true --+leeway--> COG
 *
 * Angles are signed +E/-W and every result is normalised to [0, 360), the same
 * convention as calculators/dr/dr_core.js, minus its current step: this form has
 * no current, so COG equals course through water. DokumentacjaJSON_v1.docx
 * describes leeway as the only wind-driven course correction and mentions no
 * current at all.
 *
 * Nothing here touches the DOM. The form reads its own fields and hands over a
 * plain ctx object; every function returns null (or omits the members it could
 * not resolve) rather than a wrong number.
 *
 * Loaded as a plain script in the browser (window.CourseChain) and required
 * directly by tests/js/course_chain.test.js under node --test.
 */
(function (global) {
    'use strict';

    /** Leeway band keys, in the order the leeway table is matched. */
    const POINTS_OF_SAIL = ['close_hauled', 'beam_reach', 'broad_reach', 'running'];

    function normalize360(deg) {
        return ((deg % 360) + 360) % 360;
    }

    /** Folds to (-180, 180]. Negative means anticlockwise of the reference. */
    function normalize180(deg) {
        const n = normalize360(deg);
        return n > 180 ? n - 360 : n;
    }

    /** Angular separation the short way round, 0…180. */
    function angularDelta(a, b) {
        return Math.abs(normalize180(a - b));
    }

    /** The schema stores 4 decimal places (multipleOf: 0.0001). */
    function round4(x) {
        return Math.round(x * 10000) / 10000;
    }

    /**
     * Great-circle distance in nautical miles.
     *
     * graticule_formatter.js is a plain script: in the browser it has already
     * put calculateDistance on the global object; under node --test it is
     * require()d through its module.exports guard.
     */
    function distanceNm(lat1, lon1, lat2, lon2) {
        if (typeof global.calculateDistance === 'function') {
            return global.calculateDistance(lat1, lon1, lat2, lon2);
        }
        return require('../graticule/graticule_formatter.js')
            .calculateDistance(lat1, lon1, lat2, lon2);
    }

    /**
     * Deviation for a compass course, read off the card the way a student reads
     * a paper one: the nearest filled cell, no interpolation.
     *
     * DokumentacjaJSON_v1.docx describes heading_deg as "Kurs kompasowy", so the
     * lookup key is the compass course, not the magnetic one.
     *
     * @param {Array<{heading_deg:number, deviation_deg:number}>} card filled cells only
     * @param {number} compassDeg
     * @returns {{deg:number, cellHeading:number}|null}
     */
    function deviationAt(card, compassDeg) {
        if (!Array.isArray(card) || card.length === 0) return null;
        if (!Number.isFinite(compassDeg)) return null;

        const target = normalize360(compassDeg);
        let best = null;
        card.forEach(function (cell) {
            if (!Number.isFinite(cell.heading_deg) || !Number.isFinite(cell.deviation_deg)) return;
            const heading = normalize360(cell.heading_deg);
            const delta = angularDelta(heading, target);
            if (best === null || delta < best.delta - 1e-9) {
                best = { delta: delta, cellHeading: heading, deg: cell.deviation_deg };
            } else if (Math.abs(delta - best.delta) < 1e-9 && normalize180(heading - target) > 0) {
                // Tie: resolve clockwise, which also wraps cleanly (a tie at 355
                // between filled 350 and 0 picks 0).
                best = { delta: delta, cellHeading: heading, deg: cell.deviation_deg };
            }
        });
        if (best === null) return null;
        return { deg: best.deg, cellHeading: best.cellHeading };
    }

    /**
     * Magnetic variation at a track point.
     *
     * Entry 0 is the chart-wide default — navigation_task_form.js seeds it with
     * lat/lon/range 0 precisely as a base entry. Any later entry whose circle
     * (centre + range_nm, "Promień oddziaływania deklinacji") contains the point
     * overrides it, nearest centre first. The winner is then aged to the track
     * point's year.
     *
     * The position only selects which entry applies, so a row with no position
     * still gets entry 0. The year is required.
     *
     * annual_change_deg is in degrees here: the form takes it in minutes and
     * converts on the way in, so this stays in the units the JSON carries.
     *
     * @returns {{deg:number, entryIndex:number}|null}
     */
    function variationAt(mvList, lat, lon, year) {
        if (!Array.isArray(mvList) || mvList.length === 0) return null;
        if (!Number.isFinite(year)) return null;

        let bestIndex = 0;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            let bestDist = Infinity;
            for (let i = 1; i < mvList.length; i++) {
                const e = mvList[i];
                if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon) || !Number.isFinite(e.range_nm)) continue;
                const d = distanceNm(lat, lon, e.lat, e.lon);
                if (d <= e.range_nm && d < bestDist) {
                    bestDist = d;
                    bestIndex = i;
                }
            }
        }

        const entry = mvList[bestIndex];
        if (!Number.isFinite(entry.base_deg) ||
            !Number.isFinite(entry.base_year) ||
            !Number.isFinite(entry.annual_change_deg)) {
            return null;
        }
        const deg = entry.base_deg + entry.annual_change_deg * (year - entry.base_year);
        return { deg: round4(deg), entryIndex: bestIndex };
    }

    /**
     * Which leeway band an absolute wind angle falls in.
     *
     * Bands are half-open (min <= |rel| < max) so overlapping ranges cannot both
     * claim an angle; the band with the largest max_deg also owns its upper bound
     * so that dead downwind (180) still matches. First match in POINTS_OF_SAIL
     * order wins.
     */
    function bandFor(table, absRel) {
        if (!table) return null;
        const bands = [];
        POINTS_OF_SAIL.forEach(function (key) {
            const entry = table[key];
            if (!entry || !entry.range) return;
            if (!Number.isFinite(entry.range.min_deg) ||
                !Number.isFinite(entry.range.max_deg) ||
                !Number.isFinite(entry.value_deg)) return;
            bands.push({ key: key, min: entry.range.min_deg, max: entry.range.max_deg, value: entry.value_deg });
        });
        if (bands.length === 0) return null;

        const widestMax = Math.max.apply(null, bands.map(function (b) { return b.max; }));
        for (let i = 0; i < bands.length; i++) {
            const b = bands[i];
            const withinTop = b.max === widestMax ? absRel <= b.max : absRel < b.max;
            if (absRel >= b.min && withinTop) return b;
        }
        return null;
    }

    /**
     * Leeway for a true heading in a given true wind.
     *
     * The boat is pushed downwind, so the sign follows the tack: wind on the
     * starboard side drifts the boat to port (negative), wind on port drifts it
     * to starboard (positive). A wind angle in no band — head to wind, or a table
     * with gaps — yields null rather than a guess.
     *
     * @returns {{deg:number, pointOfSail:string, tack:string}|null}
     */
    function leewayFor(table, windTrueDeg, trueHdgDeg) {
        if (!Number.isFinite(windTrueDeg) || !Number.isFinite(trueHdgDeg)) return null;
        const rel = normalize180(windTrueDeg - trueHdgDeg);
        const band = bandFor(table, Math.abs(rel));
        if (!band) return null;

        const magnitude = Math.abs(band.value);
        // rel of exactly 0 or 180 has no unambiguous tack; both fall to starboard.
        const tack = rel >= 0 ? 'starboard' : 'port';
        const deg = tack === 'starboard' ? -magnitude : magnitude;
        return { deg: round4(deg), pointOfSail: band.key, tack: tack };
    }

    /** Display helpers for the steps[] lines the button shows on hover. */
    function fmtDeg(x) {
        return normalize360(x).toFixed(1) + '°';
    }
    function fmtSigned(x) {
        return (x < 0 ? '−' : '+') + Math.abs(x).toFixed(1) + '°';
    }
    function fmtCell(x) {
        return String(Math.round(x)).padStart(3, '0') + '°';
    }

    /**
     * Forward chain: compass -> magnetic -> true -> COG.
     *
     * Resolves as far as the inputs allow. Each hop that cannot be taken adds a
     * reason to missing[] and stops the chain there; earlier members stay on the
     * result, so a row with no wind still gets its true course.
     */
    function forward(compassDeg, ctx) {
        const steps = [];
        const out = { steps: steps, missing: [] };
        if (!Number.isFinite(compassDeg)) {
            out.missing.push('a compass course');
            return out;
        }
        steps.push('compass ' + fmtDeg(compassDeg));

        const dev = deviationAt(ctx.card, compassDeg);
        if (!dev) {
            out.missing.push('a deviation card entry');
            return out;
        }
        out.magnetic = normalize360(compassDeg + dev.deg);
        steps.push('+dev ' + fmtSigned(dev.deg) + ' (card ' + fmtCell(dev.cellHeading) + ')' +
                   ' = magnetic ' + fmtDeg(out.magnetic));

        const vr = variationAt(ctx.mvList, ctx.lat, ctx.lon, ctx.year);
        if (!vr) {
            out.missing.push('variation (needs this row’s time and a variation entry)');
            return out;
        }
        out.trueDeg = normalize360(out.magnetic + vr.deg);
        steps.push('+var ' + fmtSigned(vr.deg) + ' (mv.' + vr.entryIndex + ', ' + ctx.year + ')' +
                   ' = true ' + fmtDeg(out.trueDeg));

        const lw = leewayFor(ctx.leewayTable, ctx.windTrueDeg, out.trueDeg);
        if (!lw) {
            out.missing.push('leeway (needs wind and a point of sail that matches)');
            return out;
        }
        out.cog = normalize360(out.trueDeg + lw.deg);
        steps.push('+leeway ' + fmtSigned(lw.deg) + ' (' + lw.pointOfSail + ', wind on ' + lw.tack + ')' +
                   ' = COG ' + fmtDeg(out.cog));

        return out;
    }

    /**
     * Invert the nearest-cell deviation lookup exactly.
     *
     * Deviation depends on the compass course it produces, so this enumerates
     * rather than iterates: a step function can make fixed-point iteration
     * oscillate between two neighbouring cells forever. For each filled cell the
     * candidate compass course is magnetic - deviation; it survives only if that
     * course really does read off that same cell.
     *
     * @returns {{compass:number, cellHeading:number}|null} nearest candidate to magnetic
     */
    function solveCompass(card, magnetic) {
        if (!Array.isArray(card) || card.length === 0) return null;
        if (!Number.isFinite(magnetic)) return null;

        const candidates = [];
        card.forEach(function (cell) {
            if (!Number.isFinite(cell.heading_deg) || !Number.isFinite(cell.deviation_deg)) return;
            const compass = normalize360(magnetic - cell.deviation_deg);
            const readBack = deviationAt(card, compass);
            if (readBack && angularDelta(readBack.cellHeading, cell.heading_deg) < 1e-9) {
                candidates.push({ compass: round4(compass), cellHeading: normalize360(cell.heading_deg) });
            }
        });
        if (candidates.length === 0) return null;
        candidates.sort(function (a, b) {
            return angularDelta(a.compass, magnetic) - angularDelta(b.compass, magnetic);
        });
        return candidates[0];
    }

    /**
     * Invert the leeway step exactly, by the same enumerate-and-verify argument:
     * the band depends on the true heading being solved for. Every band and both
     * tacks are tried; a candidate survives only if the heading it implies really
     * does land in that band on that tack.
     *
     * @returns {{trueDeg:number, leeway:{deg:number, pointOfSail:string, tack:string}}|null}
     */
    function solveTrue(table, windTrueDeg, cogDeg) {
        if (!table || !Number.isFinite(windTrueDeg) || !Number.isFinite(cogDeg)) return null;

        const candidates = [];
        POINTS_OF_SAIL.forEach(function (key) {
            const entry = table[key];
            if (!entry || !Number.isFinite(entry.value_deg)) return;
            const magnitude = Math.abs(entry.value_deg);
            [magnitude, -magnitude].forEach(function (signedLeeway) {
                const trueDeg = normalize360(cogDeg - signedLeeway);
                const check = leewayFor(table, windTrueDeg, trueDeg);
                if (check && check.pointOfSail === key && Math.abs(check.deg - signedLeeway) < 1e-9) {
                    candidates.push({ trueDeg: round4(trueDeg), leeway: check });
                }
            });
        });
        if (candidates.length === 0) return null;
        candidates.sort(function (a, b) {
            return angularDelta(a.trueDeg, cogDeg) - angularDelta(b.trueDeg, cogDeg);
        });
        return candidates[0];
    }

    /** Shared upward leg: true -> magnetic -> compass. Mutates out/steps. */
    function upFromTrue(trueDeg, ctx, out, steps) {
        const vr = variationAt(ctx.mvList, ctx.lat, ctx.lon, ctx.year);
        if (!vr) {
            out.missing.push('variation (needs this row’s time and a variation entry)');
            return;
        }
        out.magnetic = normalize360(trueDeg - vr.deg);
        steps.push('−var ' + fmtSigned(vr.deg) + ' (mv.' + vr.entryIndex + ', ' + ctx.year + ')' +
                   ' = magnetic ' + fmtDeg(out.magnetic));

        const solved = solveCompass(ctx.card, out.magnetic);
        if (!solved) {
            out.missing.push('compass (no deviation card entry is consistent)');
            return;
        }
        out.compass = solved.compass;
        steps.push('−dev (card ' + fmtCell(solved.cellHeading) + ')' +
                   ' = compass ' + fmtDeg(out.compass));
    }

    /**
     * Anchor on the true course: derive COG downwards, magnetic and compass
     * upwards. Both directions are attempted independently, so a missing wind
     * costs only the COG.
     */
    function solveFromTrue(trueDeg, ctx) {
        const steps = [];
        const out = { steps: steps, missing: [] };
        if (!Number.isFinite(trueDeg)) {
            out.missing.push('a true course');
            return out;
        }
        steps.push('true ' + fmtDeg(trueDeg));

        const lw = leewayFor(ctx.leewayTable, ctx.windTrueDeg, trueDeg);
        if (lw) {
            out.cog = normalize360(trueDeg + lw.deg);
            steps.push('+leeway ' + fmtSigned(lw.deg) + ' (' + lw.pointOfSail + ', wind on ' + lw.tack + ')' +
                       ' = COG ' + fmtDeg(out.cog));
        } else {
            out.missing.push('leeway (needs wind and a point of sail that matches)');
        }

        upFromTrue(trueDeg, ctx, out, steps);
        return out;
    }

    /** Anchor on COG: solve the leeway step, then walk up to compass. */
    function solveFromCOG(cogDeg, ctx) {
        const steps = [];
        const out = { steps: steps, missing: [] };
        if (!Number.isFinite(cogDeg)) {
            out.missing.push('a course over ground');
            return out;
        }
        steps.push('COG ' + fmtDeg(cogDeg));

        const solved = solveTrue(ctx.leewayTable, ctx.windTrueDeg, cogDeg);
        if (!solved) {
            out.missing.push('leeway (needs wind, and no point of sail produces this COG)');
            return out;
        }
        out.trueDeg = solved.trueDeg;
        steps.push('−leeway ' + fmtSigned(solved.leeway.deg) +
                   ' (' + solved.leeway.pointOfSail + ', wind on ' + solved.leeway.tack + ')' +
                   ' = true ' + fmtDeg(out.trueDeg));

        upFromTrue(out.trueDeg, ctx, out, steps);
        return out;
    }

    const CourseChain = {
        POINTS_OF_SAIL: POINTS_OF_SAIL,
        normalize360: normalize360,
        normalize180: normalize180,
        angularDelta: angularDelta,
        round4: round4,
        deviationAt: deviationAt,
        variationAt: variationAt,
        leewayFor: leewayFor,
        forward: forward,
        solveFromTrue: solveFromTrue,
        solveFromCOG: solveFromCOG,
    };

    global.CourseChain = CourseChain;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CourseChain;
    }
})(typeof window !== 'undefined' ? window : globalThis);