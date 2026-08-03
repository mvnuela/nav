/**
 * Dead Reckoning Calculator - Core Math
 * Pure functions: no DOM, no Leaflet, no canvas dependencies.
 *
 * Algorithm (CADET):
 *   Compass HDG + Deviation = Magnetic HDG + Variation = True HDG
 *   True HDG + Leeway = Course Through Water (CTW)
 *   Water vector (CTW @ STW × time) + Current vector (Set @ Drift × time) = Ground vector
 *   Ground vector → COG, SOG, distance, new lat/lon
 */
(function() {
    'use strict';

    window.DR = window.DR || {};

    function normalize(angle) {
        angle = angle % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    /**
     * Grey out & disable the variation / deviation inputs when the course
     * is True (CADET chain is irrelevant), restore them when Compass.
     * Idempotent — safe to call multiple times. Assumes the form uses
     * #drVariation and #drDeviation; radios match the given `name`.
     */
    window.DR.bindCourseTypeToggle = function(radioName) {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        if (radios.length === 0) return;
        const variation = document.getElementById('drVariation');
        const deviation = document.getElementById('drDeviation');
        if (!variation || !deviation) return;

        function apply() {
            const checked = document.querySelector(`input[name="${radioName}"]:checked`);
            const isTrue = checked && checked.value === 'true';
            [variation, deviation].forEach(input => {
                input.disabled = isTrue;
                input.title = isTrue ? 'Not used when course is True' : '';
                input.style.opacity = isTrue ? '0.5' : '';
                input.style.cursor = isTrue ? 'not-allowed' : '';
            });
        }

        radios.forEach(radio => radio.addEventListener('change', apply));
        apply();
    };

    /**
     * Parse a coordinate input string. Accepts decimal ("54.5") or
     * nautical ("54°22.5'N"). Returns a number or NaN.
     * Relies on nauticalToDecimal from graticule_formatter.js for nautical input.
     */
    window.DR.parseCoord = function(input) {
        if (typeof input === 'number') return input;
        if (typeof input !== 'string') return NaN;
        const s = input.trim();
        if (s === '') return NaN;
        // No symbol-sniffing branch: nauticalToDecimal also parses plain
        // decimals, with comma or dot — "54,375" through parseFloat came out
        // as a silently truncated 54.
        return typeof nauticalToDecimal === 'function' ? nauticalToDecimal(s) : parseFloat(s);
    };

    /**
     * Calculate dead reckoning position.
     *
     * @param {Object} input
     *   startLat, startLon : decimal degrees (required, finite)
     *   course             : degrees, 0-360 (required)
     *   courseType         : 'compass' (default) | 'true'
     *   deviation          : degrees, signed (+E/-W), default 0
     *   variation          : degrees, signed (+E/-W), default 0
     *   leeway             : degrees, signed (+stbd/-port), default 0
     *   speed              : knots (STW), required, >= 0
     *   currentSet         : degrees true (direction current flows TO), default 0
     *   currentDrift       : knots, default 0
     *   time               : hours, required, >= 0
     *
     * @returns {Object}
     *   ok: boolean
     *   error?: string (when ok=false)
     *   newLat, newLon
     *   compassHeading, magneticHeading, trueHeading, ctw
     *   cog, sog
     *   distance      (ground distance, NM)
     *   waterDist     (NM)
     *   currentDist   (NM)
     *   waterEndLat, waterEndLon  (intermediate point for plotting the water leg)
     *   steps         (array of human-readable description strings)
     */
    window.DR.calculate = function(input) {
        const startLat = input.startLat;
        const startLon = input.startLon;
        const course = input.course;
        const courseType = input.courseType || 'compass';
        const deviation = input.deviation || 0;
        const variation = input.variation || 0;
        const leeway = input.leeway || 0;
        const speed = input.speed;
        const currentSet = input.currentSet || 0;
        const currentDrift = input.currentDrift || 0;
        const time = input.time;

        if (!isFinite(startLat) || !isFinite(startLon)) {
            return { ok: false, error: 'Invalid start position' };
        }
        if (startLat < -90 || startLat > 90) {
            return { ok: false, error: 'Latitude must be between -90 and 90' };
        }
        if (startLon < -180 || startLon > 180) {
            return { ok: false, error: 'Longitude must be between -180 and 180' };
        }
        if (!isFinite(course) || course < 0 || course > 360) {
            return { ok: false, error: 'Course must be 0-360°' };
        }
        if (!isFinite(speed) || speed < 0) {
            return { ok: false, error: 'Speed must be ≥ 0' };
        }
        if (!isFinite(time) || time < 0) {
            return { ok: false, error: 'Time must be ≥ 0' };
        }
        if (currentSet < 0 || currentSet > 360) {
            return { ok: false, error: 'Current set must be 0-360°' };
        }
        if (currentDrift < 0) {
            return { ok: false, error: 'Current drift must be ≥ 0' };
        }

        let compassHeading = null;
        let magneticHeading = null;
        let trueHeading;
        const steps = [];

        if (courseType === 'compass') {
            compassHeading = course;
            magneticHeading = normalize(compassHeading + deviation);
            trueHeading = normalize(magneticHeading + variation);

            steps.push(`Compass HDG: ${compassHeading.toFixed(1)}°`);
            if (deviation !== 0) {
                steps.push(`+ Deviation ${deviation.toFixed(1)}° → Magnetic ${magneticHeading.toFixed(1)}°`);
            }
            if (variation !== 0) {
                steps.push(`+ Variation ${variation.toFixed(1)}° → True HDG ${trueHeading.toFixed(1)}°`);
            }
            if (deviation === 0 && variation === 0) {
                steps.push(`True HDG: ${trueHeading.toFixed(1)}°`);
            }
        } else {
            trueHeading = course;
            steps.push(`True HDG: ${trueHeading.toFixed(1)}°`);
        }

        const ctw = normalize(trueHeading + leeway);
        if (leeway !== 0) {
            steps.push(`+ Leeway ${leeway.toFixed(1)}° → CTW ${ctw.toFixed(1)}°`);
        }

        const waterDist = speed * time;
        const ctwRad = ctw * Math.PI / 180;
        const waterN = waterDist * Math.cos(ctwRad);
        const waterE = waterDist * Math.sin(ctwRad);

        const currentDist = currentDrift * time;
        const setRad = currentSet * Math.PI / 180;
        const currentN = currentDist * Math.cos(setRad);
        const currentE = currentDist * Math.sin(setRad);

        const groundN = waterN + currentN;
        const groundE = waterE + currentE;

        const distance = Math.sqrt(groundN * groundN + groundE * groundE);
        const cog = distance > 1e-9
            ? normalize(Math.atan2(groundE, groundN) * 180 / Math.PI)
            : ctw;
        const sog = time > 0 ? distance / time : 0;

        if (currentDrift !== 0) {
            steps.push(`+ Current ${currentSet.toFixed(1)}°/${currentDrift.toFixed(1)}kt → COG ${cog.toFixed(1)}° / SOG ${sog.toFixed(2)}kt`);
        }

        // Flat-earth conversion: adequate for typical DR legs.
        const latRad = startLat * Math.PI / 180;
        const dLat = groundN / 60;
        const dLon = groundE / (60 * Math.cos(latRad));
        const newLat = startLat + dLat;
        const newLon = startLon + dLon;

        const waterEndLat = startLat + waterN / 60;
        const waterEndLon = startLon + waterE / (60 * Math.cos(latRad));

        return {
            ok: true,
            newLat, newLon,
            compassHeading, magneticHeading, trueHeading, ctw,
            cog, sog, distance,
            waterDist, currentDist,
            waterEndLat, waterEndLon,
            steps
        };
    };
})();