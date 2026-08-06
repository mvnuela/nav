/**
 * Two-Bearing Fix Calculator - Core Math
 *
 * Algorithm:
 *   Two simultaneous compass bearings on two charted objects → observed
 *   position via CADET + plane sailing + LOP intersection on a local
 *   flat patch (Mercator chart navigation methods).
 */
(function() {
    'use strict';

    window.Fix = window.Fix || {};

    function normalize(angle) {
        angle = angle % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    /**
     * Parse a coordinate input string. Accepts decimal ("54.5") or
     * nautical ("54°22.5'N"). Returns a number or NaN.
     */
    window.Fix.parseCoord = function(input) {
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
     * Compute observed position from two simultaneous compass bearings on two objects.
     *
     * @param {Object} input
     *   objALat, objALon : Object A position (decimal degrees, required)
     *   objBLat, objBLon : Object B position (decimal degrees, required)
     *   bearingA         : compass bearing to A (0-360°, required)
     *   bearingB         : compass bearing to B (0-360°, required)
     *   deviation        : compass deviation (+E/-W, default 0)
     *   variation        : magnetic variation (+E/-W, default 0)
     *
     * @returns {Object}
     *   ok: boolean
     *   error?: string
     *   fixLat, fixLon            : observed position
     *   B_A_true, B_B_true        : true bearings after CADET
     *   angleOfCut                : degrees, 0-90 (line geometry)
     *   distFromA, distFromB      : NM along each LOP
     *   E_AB, N_AB                : local-frame offset of B from A (NM)
     *   steps                     : human-readable description strings
     *   warnings                  : array of warning strings
     */
    window.Fix.calculate = function(input) {
        const objALat = input.objALat;
        const objALon = input.objALon;
        const objBLat = input.objBLat;
        const objBLon = input.objBLon;
        const bearingA = input.bearingA;
        const bearingB = input.bearingB;
        const deviation = input.deviation || 0;
        const variation = input.variation || 0;

        if (!isFinite(objALat) || !isFinite(objALon)) {
            return { ok: false, error: 'Invalid Object A position' };
        }
        if (!isFinite(objBLat) || !isFinite(objBLon)) {
            return { ok: false, error: 'Invalid Object B position' };
        }
        if (objALat < -90 || objALat > 90 || objBLat < -90 || objBLat > 90) {
            return { ok: false, error: 'Latitude must be between -90 and 90' };
        }
        if (objALon < -180 || objALon > 180 || objBLon < -180 || objBLon > 180) {
            return { ok: false, error: 'Longitude must be between -180 and 180' };
        }
        if (!isFinite(bearingA) || bearingA < 0 || bearingA > 360) {
            return { ok: false, error: 'Bearing to A must be 0-360°' };
        }
        if (!isFinite(bearingB) || bearingB < 0 || bearingB > 360) {
            return { ok: false, error: 'Bearing to B must be 0-360°' };
        }

        // Step 1: CADET on both bearings (Compass + Deviation + Variation → True)
        const B_A_true = normalize(bearingA + deviation + variation);
        const B_B_true = normalize(bearingB + deviation + variation);

        // Step 2: Object B in local frame centred on Object A (plane sailing on a mid-lat patch)
        const objMeanLat = (objALat + objBLat) / 2;
        const objMeanLatRad = objMeanLat * Math.PI / 180;
        const E_AB = (objBLon - objALon) * 60 * Math.cos(objMeanLatRad);
        const N_AB = (objBLat - objALat) * 60;

        const objDist = Math.sqrt(E_AB * E_AB + N_AB * N_AB);
        if (objDist < 0.05) {
            return { ok: false, error: 'Object A and Object B are too close (< 0.05 NM) — no reliable fix' };
        }

        // Angle of cut between LOPs (treating them as lines, not rays — result in [0°, 90°])
        const rawDiff = normalize(B_B_true - B_A_true);              // [0, 360)
        const halfDiff = Math.min(rawDiff, 360 - rawDiff);           // [0, 180]
        const angleOfCut = halfDiff > 90 ? 180 - halfDiff : halfDiff; // [0, 90]

        // Parallel-LOP check (reject below 5°)
        const det = Math.sin((B_B_true - B_A_true) * Math.PI / 180);
        if (Math.abs(det) < Math.sin(5 * Math.PI / 180)) {
            return {
                ok: false,
                error: `Angle of cut too small (${angleOfCut.toFixed(1)}°) — bearings nearly parallel, no reliable fix`
            };
        }

        // Step 3: Solve LOP intersection in A-centred local frame
        const B_A_rad = B_A_true * Math.PI / 180;
        const B_B_rad = B_B_true * Math.PI / 180;
        const sinA = Math.sin(B_A_rad);
        const cosA = Math.cos(B_A_rad);
        const sinB = Math.sin(B_B_rad);
        const cosB = Math.cos(B_B_rad);

        const t = (N_AB * sinB - E_AB * cosB) / det;
        const s = (N_AB * sinA - E_AB * cosA) / det;

        const fix_E = t * sinA;
        const fix_N = t * cosA;

        // Step 4: Convert NM offset → lat/lon (mid-latitude sailing)
        const dLat = fix_N / 60;
        const fixLat = objALat + dLat;
        const meanLat = (objALat + fixLat) / 2;
        const meanLatRad = meanLat * Math.PI / 180;
        const dLon = fix_E / (60 * Math.cos(meanLatRad));
        const fixLon = objALon + dLon;

        const distFromA = Math.abs(t);
        const distFromB = Math.abs(s);

        const warnings = [];
        if (angleOfCut < 30) {
            warnings.push(`Weak fix — angle of cut ${angleOfCut.toFixed(1)}° (ideal 90°)`);
        }

        const correctionLabel = (deviation !== 0 || variation !== 0)
            ? `+ dev ${deviation.toFixed(1)}° + var ${variation.toFixed(1)}°`
            : '';
        const cutQuality = angleOfCut >= 60 ? 'good'
            : angleOfCut >= 30 ? 'acceptable'
            : 'weak';

        const steps = [
            `B_A compass ${bearingA.toFixed(1)}° ${correctionLabel} → B_A true ${B_A_true.toFixed(1)}°`,
            `B_B compass ${bearingB.toFixed(1)}° ${correctionLabel} → B_B true ${B_B_true.toFixed(1)}°`,
            `Object B from A: ${E_AB.toFixed(2)} NM east, ${N_AB.toFixed(2)} NM north (mid-lat ${objMeanLat.toFixed(2)}°)`,
            `Angle of cut: ${angleOfCut.toFixed(1)}° (${cutQuality})`,
            `Fix is ${distFromA.toFixed(2)} NM from A, ${distFromB.toFixed(2)} NM from B`
        ];

        return {
            ok: true,
            fixLat, fixLon,
            B_A_true, B_B_true,
            angleOfCut,
            distFromA, distFromB,
            E_AB, N_AB,
            steps,
            warnings
        };
    };
})();
