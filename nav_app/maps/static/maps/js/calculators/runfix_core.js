/**
 * Running Fix Calculator - Core Math
 *
 * Algorithm:
 *   Two compass bearings on the SAME charted object taken at different times,
 *   with the vessel running between them. The first LOP is advanced parallel
 *   to itself by the run (ground) vector; its intersection with the second LOP
 *   is the observed position at T2.
 *
 *   KEY SIMPLIFICATION: a running fix is just a two-bearing fix in disguise.
 *   The advanced LOP1 passes through (object + run vector) at bearing B1; LOP2
 *   passes through the object at bearing B2. That's two LOPs through two known
 *   points — exactly what window.Fix.calculate already solves. So we compute
 *   the run vector with the DR engine, translate the object by it to make a
 *   "virtual second object", and delegate the intersection to Fix.calculate.
 *   No duplicated geometry. Fully analytical — no plotting.
 *
 * Depends on window.DR (dr_core.js) for the run vector and
 *            window.Fix (fix_core.js) for the LOP intersection.
 */
(function() {
    'use strict';

    window.RunFix = window.RunFix || {};

    function normalize(angle) {
        angle = angle % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    /**
     * Grey out & disable the variation / deviation inputs only when BOTH the
     * bearings and the run course are True — i.e. when neither CADET chain
     * (bearings or heading) uses the compass corrections. Restore them as soon
     * as either selector is Compass. Idempotent. Assumes #runfixVariation /
     * #runfixDeviation and the two given radio groups exist.
     */
    window.RunFix.bindCorrectionToggle = function(bearingRadioName, courseRadioName) {
        const variation = document.getElementById('runfixVariation');
        const deviation = document.getElementById('runfixDeviation');
        if (!variation || !deviation) return;

        function apply() {
            const bChecked = document.querySelector(`input[name="${bearingRadioName}"]:checked`);
            const cChecked = document.querySelector(`input[name="${courseRadioName}"]:checked`);
            const bearingsTrue = bChecked && bChecked.value === 'true';
            const courseTrue = cChecked && cChecked.value === 'true';
            const irrelevant = bearingsTrue && courseTrue;
            [variation, deviation].forEach(input => {
                input.disabled = irrelevant;
                input.title = irrelevant ? 'Not used when bearings and course are both True' : '';
                input.style.opacity = irrelevant ? '0.5' : '';
                input.style.cursor = irrelevant ? 'not-allowed' : '';
            });
        }

        document.querySelectorAll(`input[name="${bearingRadioName}"]`).forEach(r => r.addEventListener('change', apply));
        document.querySelectorAll(`input[name="${courseRadioName}"]`).forEach(r => r.addEventListener('change', apply));
        apply();
    };

    /**
     * Parse a coordinate input string. Accepts decimal ("54.5") or
     * nautical ("54°22.5'N"). Returns a number or NaN.
     */
    window.RunFix.parseCoord = function(input) {
        if (typeof input === 'number') return input;
        if (typeof input !== 'string') return NaN;
        const s = input.trim();
        if (s === '') return NaN;
        if (s.includes('°') || s.includes("'")) {
            return typeof nauticalToDecimal === 'function' ? nauticalToDecimal(s) : NaN;
        }
        return parseFloat(s);
    };

    /**
     * Compute observed position from two bearings on the same object over a run.
     *
     * @param {Object} input
     *   objLat, objLon   : charted object position (decimal degrees, required)
     *   bearing1         : first bearing to object (0-360°, required)
     *   bearing1Type     : 'compass' (default) | 'true'
     *   bearing2         : second bearing to object (0-360°, required)
     *   bearing2Type     : 'compass' (default) | 'true'
     *   deviation        : compass deviation (+E/-W, default 0)
     *   variation        : magnetic variation (+E/-W, default 0)
     *   course           : vessel heading during the run (0-360°, required)
     *   courseType       : 'compass' (default) | 'true'
     *   leeway           : degrees, signed (+stbd/-port), default 0
     *   speed            : STW knots (required, >= 0)
     *   currentSet       : degrees true (toward), default 0
     *   currentDrift     : knots, default 0
     *   runTime          : T2 - T1, hours (required, >= 0)
     *
     * @returns {Object}
     *   ok: boolean
     *   error?: string
     *   fixLat, fixLon                 : observed position at T2
     *   B1_true, B2_true               : true bearings after CADET
     *   angleOfCut                     : degrees, 0-90 (line geometry)
     *   trueHeading, ctw               : run heading chain
     *   runCog, runDistance            : ground vector (COG / NM) for the run
     *   R_E, R_N                       : run vector components (NM)
     *   advancedLOP1_originLat, advancedLOP1_originLon : point O + R
     *   fixDistanceFromObject          : NM from object to the fix
     *   steps                          : human-readable description strings
     *   warnings                       : array of warning strings
     */
    window.RunFix.calculate = function(input) {
        const objLat = input.objLat;
        const objLon = input.objLon;
        const bearing1 = input.bearing1;
        const bearing1Type = input.bearing1Type || 'compass';
        const bearing2 = input.bearing2;
        const bearing2Type = input.bearing2Type || 'compass';
        const deviation = input.deviation || 0;
        const variation = input.variation || 0;
        const runTime = input.runTime;

        if (typeof window.DR === 'undefined' || typeof window.DR.calculate !== 'function') {
            return { ok: false, error: 'Dead Reckoning engine (dr_core.js) not loaded' };
        }
        if (typeof window.Fix === 'undefined' || typeof window.Fix.calculate !== 'function') {
            return { ok: false, error: 'Two-Bearing Fix engine (fix_core.js) not loaded' };
        }
        if (!isFinite(objLat) || !isFinite(objLon)) {
            return { ok: false, error: 'Invalid object position' };
        }
        if (objLat < -90 || objLat > 90) {
            return { ok: false, error: 'Latitude must be between -90 and 90' };
        }
        if (objLon < -180 || objLon > 180) {
            return { ok: false, error: 'Longitude must be between -180 and 180' };
        }
        if (!isFinite(bearing1) || bearing1 < 0 || bearing1 > 360) {
            return { ok: false, error: 'First bearing must be 0-360°' };
        }
        if (!isFinite(bearing2) || bearing2 < 0 || bearing2 > 360) {
            return { ok: false, error: 'Second bearing must be 0-360°' };
        }
        if (!isFinite(runTime) || runTime < 0) {
            return { ok: false, error: 'Run time must be ≥ 0' };
        }

        // Step 1: CADET on each bearing (Compass + Deviation + Variation → True)
        const B1_true = bearing1Type === 'compass'
            ? normalize(bearing1 + deviation + variation)
            : normalize(bearing1);
        const B2_true = bearing2Type === 'compass'
            ? normalize(bearing2 + deviation + variation)
            : normalize(bearing2);

        // Step 2: Run (ground) vector — reuse the DR engine. The object position
        // is used as the start purely to satisfy DR validation; we only consume
        // the ground vector (COG + distance), not the resulting position.
        const dr = window.DR.calculate({
            startLat: objLat,
            startLon: objLon,
            course: input.course,
            courseType: input.courseType || 'compass',
            deviation: deviation,
            variation: variation,
            leeway: input.leeway || 0,
            speed: input.speed,
            currentSet: input.currentSet || 0,
            currentDrift: input.currentDrift || 0,
            time: runTime
        });
        if (!dr.ok) {
            return { ok: false, error: `Run vector: ${dr.error}` };
        }

        const runCog = dr.cog;
        const runDistance = dr.distance;            // ground distance, NM
        const runCogRad = runCog * Math.PI / 180;
        const R_E = runDistance * Math.sin(runCogRad);
        const R_N = runDistance * Math.cos(runCogRad);

        // Translate the object by the run vector → "virtual second object" at the
        // point the advanced LOP1 passes through (mid-latitude sailing).
        const advLat = objLat + R_N / 60;
        const advMeanLatRad = ((objLat + advLat) / 2) * Math.PI / 180;
        const advancedLOP1_originLat = advLat;
        const advancedLOP1_originLon = objLon + R_E / (60 * Math.cos(advMeanLatRad));

        // Step 3+4: delegate the LOP intersection to the two-bearing fix solver.
        //   Object A = the object itself, at bearing B2  (LOP2 through O)
        //   Object B = object + run vector, at bearing B1 (advanced LOP1)
        // Bearings are already true, so pass deviation/variation = 0 (CADET is identity).
        const fr = window.Fix.calculate({
            objALat: objLat,            objALon: objLon,            bearingA: B2_true,
            objBLat: advancedLOP1_originLat, objBLon: advancedLOP1_originLon, bearingB: B1_true,
            deviation: 0, variation: 0
        });
        if (!fr.ok) {
            // Re-phrase the "objects too close" case in run-fix terms (it means a tiny run).
            const err = /too close/i.test(fr.error)
                ? `Run too small (${runDistance.toFixed(2)} NM) — no reliable fix`
                : fr.error;
            return { ok: false, error: err };
        }

        const fixLat = fr.fixLat;
        const fixLon = fr.fixLon;
        const angleOfCut = fr.angleOfCut;
        const fixDistanceFromObject = fr.distFromA;   // dist from object O along LOP2

        const warnings = fr.warnings.slice();
        if (runDistance < 0.1) {
            warnings.push(`Very small run (${runDistance.toFixed(2)} NM) — fix unreliable`);
        }

        const correctionLabel = (deviation !== 0 || variation !== 0)
            ? `+ dev ${deviation.toFixed(1)}° + var ${variation.toFixed(1)}°`
            : '';
        const b1Label = bearing1Type === 'compass'
            ? `B1 compass ${bearing1.toFixed(1)}° ${correctionLabel} → B1 true ${B1_true.toFixed(1)}°`
            : `B1 true ${B1_true.toFixed(1)}°`;
        const b2Label = bearing2Type === 'compass'
            ? `B2 compass ${bearing2.toFixed(1)}° ${correctionLabel} → B2 true ${B2_true.toFixed(1)}°`
            : `B2 true ${B2_true.toFixed(1)}°`;
        const cutQuality = angleOfCut >= 60 ? 'good'
            : angleOfCut >= 30 ? 'acceptable'
            : 'weak';
        const currentLabel = (input.currentDrift || 0) > 0
            ? `, current ${normalize(input.currentSet || 0).toFixed(1)}°/${(input.currentDrift || 0).toFixed(1)}kt`
            : '';

        const steps = [
            b1Label,
            b2Label,
            `Run: CTW ${dr.ctw.toFixed(1)}°, STW ${(input.speed || 0).toFixed(1)} kts, ${runTime.toFixed(1)} h${currentLabel} → COG ${runCog.toFixed(1)}°, ground dist ${runDistance.toFixed(2)} NM`,
            `Advanced LOP₁ passes through ${advancedLOP1_originLat.toFixed(3)}°, ${advancedLOP1_originLon.toFixed(3)}°`,
            `Angle of cut: ${angleOfCut.toFixed(1)}° (${cutQuality})`,
            `Fix is ${fixDistanceFromObject.toFixed(2)} NM from the object`
        ];

        return {
            ok: true,
            fixLat, fixLon,
            B1_true, B2_true,
            angleOfCut,
            trueHeading: dr.trueHeading, ctw: dr.ctw,
            runCog, runDistance,
            R_E, R_N,
            advancedLOP1_originLat, advancedLOP1_originLon,
            fixDistanceFromObject,
            distFromObjOnLOP2: fr.distFromA,   // dist from object along LOP2
            distFromObjOnLOP1: fr.distFromB,   // dist from advanced point along LOP1
            steps,
            warnings
        };
    };
})();