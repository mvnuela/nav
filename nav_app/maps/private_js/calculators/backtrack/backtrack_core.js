/**
 * Backtrack Calculator - Core Math
 * Pure functions: no DOM, no Leaflet, no canvas dependencies.
 *
 * A navigation task usually hands you the END of a leg — a buoy passed abeam,
 * a TSS boundary, the heads of a harbour read off the chart — and asks for the
 * point the boat left. That is this file: one leg, walked backwards.
 *
 *   position: run the reciprocal course back over the distance made good
 *   time:     subtract how long the leg took, crossing midnight if it must
 *   log:      subtract the distance
 *
 * Unlike the rest of the calculators/ family this module is wrapped so Node can
 * load it too (window in the browser, module.exports under the test runner),
 * which is what lets tests/js/backtrack_core.test.js exist at all.
 */
(function (global) {
    'use strict';

    const MINUTES_PER_HOUR = 60;
    // Same slack the form's TOLERANCE.distance uses, so "measured 2.1, computed
    // 2.0" is reported here exactly where the form would report it.
    const DISTANCE_TOLERANCE = 0.05;

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function deg(x) {
        return Number.isFinite(x) ? x.toFixed(1) : '?';
    }

    function nm(x) {
        return Number.isFinite(x) ? String(Math.round(x * 10000) / 10000) : '?';
    }

    /** A correction left blank is no correction, not a refusal. */
    function correction(x) {
        return Number.isFinite(x) ? x : 0;
    }

    /**
     * Wall-clock arithmetic that may cross midnight backwards.
     *
     * Built on Date.UTC so the machine's own timezone — and any daylight-saving
     * step in it — cannot shift a task's local times. The task JSON carries its
     * own UTC offset; these two halves are wall-clock, and stay wall-clock.
     *
     * @returns {{date:string, time:string}|null}
     */
    function shiftLocalBack(date, time, minutes) {
        const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
        const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(time || ''));
        if (!d || !t || !Number.isFinite(minutes)) return null;

        const ms = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], +(t[3] || 0))
                 - Math.round(minutes * 60000);
        const back = new Date(ms);
        return {
            date: `${back.getUTCFullYear()}-${pad(back.getUTCMonth() + 1)}-${pad(back.getUTCDate())}`,
            time: `${pad(back.getUTCHours())}:${pad(back.getUTCMinutes())}`,
        };
    }

    /**
     * @param {Object} input see the design doc; every member optional except
     *   the known position, a course, and something that yields a distance.
     * @returns {{ok:true, …}|{ok:false, error:string}}
     */
    function calculate(input) {
        const CC = global.CourseChain;
        if (!CC) return { ok: false, error: 'Course chain not loaded' };

        const endLat = input.endLat;
        const endLon = input.endLon;
        if (!Number.isFinite(endLat) || !Number.isFinite(endLon) ||
            endLat < -90 || endLat > 90 || endLon < -180 || endLon > 180) {
            return { ok: false, error: 'Invalid known position' };
        }

        const steps = [];
        const notes = [];

        // A ready course over ground wins: it is what the boat actually made
        // good, and the corrections would only re-derive it.
        let cogUsed;
        if (Number.isFinite(input.cog)) {
            cogUsed = CC.normalize360(input.cog);
            steps.push(`COG ${deg(cogUsed)}°`);
            if (Number.isFinite(input.compass)) {
                notes.push('both courses given — used the course over ground');
            }
        } else if (Number.isFinite(input.compass)) {
            const deviation = correction(input.deviation);
            const variation = correction(input.variation);
            const leeway = correction(input.leeway);
            const magnetic = CC.normalize360(input.compass + deviation);
            const trueDeg = CC.normalize360(magnetic + variation);
            cogUsed = CC.normalize360(trueDeg + leeway);
            steps.push(`Compass ${deg(input.compass)}° + deviation ${deg(deviation)}° → magnetic ${deg(magnetic)}°`);
            steps.push(`+ variation ${deg(variation)}° → true ${deg(trueDeg)}°`);
            steps.push(`+ leeway ${deg(leeway)}° → COG ${deg(cogUsed)}°`);
        } else {
            return { ok: false, error: 'Enter a course over ground or a compass course' };
        }

        const speed = input.speed;
        const time = input.time;
        if ((Number.isFinite(speed) && speed < 0) ||
            (Number.isFinite(time) && time < 0) ||
            (Number.isFinite(input.distance) && input.distance < 0)) {
            return { ok: false, error: 'Speed, time and distance must be ≥ 0' };
        }

        const run = (Number.isFinite(speed) && Number.isFinite(time))
            ? speed * time / MINUTES_PER_HOUR
            : undefined;

        let distance;
        let minutes;
        if (Number.isFinite(input.distance)) {
            distance = input.distance;
            if (run !== undefined && Math.abs(run - distance) > DISTANCE_TOLERANCE) {
                notes.push(`speed × time give ${nm(run)} Mm — used your ${nm(distance)} Mm`);
            }
            minutes = Number.isFinite(time) ? time
                : (Number.isFinite(speed) && speed > 0 ? distance / speed * MINUTES_PER_HOUR : undefined);
        } else if (run !== undefined) {
            distance = run;
            minutes = time;
        } else {
            return { ok: false, error: 'Enter a distance, or a speed and a time' };
        }

        const reciprocal = CC.normalize360(cogUsed + 180);
        const back = CC.positionFrom(endLat, endLon, reciprocal, distance);
        if (!back) return { ok: false, error: 'Invalid known position' };
        steps.push(`Back ${nm(distance)} Mm along ${deg(reciprocal)}°`);

        const out = {
            ok: true,
            startLat: back.lat,
            startLon: back.lon,
            distance: CC.round4(distance),
            cogUsed: CC.round4(cogUsed),
            steps: steps,
            notes: notes,
        };

        if (input.endDate && input.endTime && Number.isFinite(minutes)) {
            const earlier = shiftLocalBack(input.endDate, input.endTime, minutes);
            if (earlier) {
                out.startDate = earlier.date;
                out.startTime = earlier.time;
                steps.push(`${input.endDate} ${input.endTime} − ${deg(minutes)} min → ${earlier.date} ${earlier.time}`);
            }
        }

        // A log that runs backwards past zero is not a number to show; it means
        // the distance and the log belong to different legs.
        if (Number.isFinite(input.endLog)) {
            const startLog = CC.round4(input.endLog - distance);
            if (startLog < 0) {
                return { ok: false, error: 'The log would go negative — check the distance' };
            }
            out.startLog = startLog;
            steps.push(`Log ${nm(input.endLog)} − ${nm(distance)} → ${nm(startLog)} Mm`);
        }

        return out;
    }

    const Backtrack = {
        calculate: calculate,
        shiftLocalBack: shiftLocalBack,
    };

    global.Backtrack = Backtrack;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Backtrack;
    }
})(typeof window !== 'undefined' ? window : globalThis);
