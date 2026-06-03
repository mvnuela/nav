/**
 * Running Fix Calculator - Enhanced Graticule adapter.
 * Reads inputs from the sidebar panel, calls window.RunFix.calculate,
 * and shows the computed position + diagnostic numbers in #runfixOut.
 * Numbers-only: does not plot on the canvas.
 */
(function() {
    'use strict';

    function init() {
        const calcBtn = document.getElementById('runfixCalcBtn');
        if (!calcBtn) return; // panel not on this page

        calcBtn.addEventListener('click', runCalculation);

        const clearBtn = document.getElementById('runfixClearBtn');
        if (clearBtn) clearBtn.addEventListener('click', clearOutput);

        ['runfixObjLat', 'runfixObjLon', 'runfixBearing1', 'runfixBearing2', 'runfixCourse',
         'runfixVariation', 'runfixDeviation', 'runfixLeeway', 'runfixSpeed',
         'runfixCurrentSet', 'runfixCurrentDrift', 'runfixRunTime'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keypress', e => {
                    if (e.key === 'Enter') runCalculation();
                });
            }
        });

        RunFix.bindCorrectionToggle('runfixBearingType', 'runfixCourseType');
    }

    function readInput() {
        const bearingTypeEl = document.querySelector('input[name="runfixBearingType"]:checked');
        const courseTypeEl = document.querySelector('input[name="runfixCourseType"]:checked');
        const bearingType = bearingTypeEl ? bearingTypeEl.value : 'compass';
        return {
            objLat: RunFix.parseCoord(document.getElementById('runfixObjLat').value),
            objLon: RunFix.parseCoord(document.getElementById('runfixObjLon').value),
            bearing1: parseFloat(document.getElementById('runfixBearing1').value),
            bearing1Type: bearingType,
            bearing2: parseFloat(document.getElementById('runfixBearing2').value),
            bearing2Type: bearingType,
            course: parseFloat(document.getElementById('runfixCourse').value),
            courseType: courseTypeEl ? courseTypeEl.value : 'compass',
            variation: parseFloat(document.getElementById('runfixVariation').value) || 0,
            deviation: parseFloat(document.getElementById('runfixDeviation').value) || 0,
            leeway: parseFloat(document.getElementById('runfixLeeway').value) || 0,
            speed: parseFloat(document.getElementById('runfixSpeed').value),
            currentSet: parseFloat(document.getElementById('runfixCurrentSet').value) || 0,
            currentDrift: parseFloat(document.getElementById('runfixCurrentDrift').value) || 0,
            runTime: parseFloat(document.getElementById('runfixRunTime').value)
        };
    }

    function runCalculation() {
        const out = document.getElementById('runfixOut');
        const result = RunFix.calculate(readInput());
        out.style.display = 'block';

        if (!result.ok) {
            out.innerHTML = `<strong style="color:#d32f2f;">⚠ ${result.error}</strong>`;
            return;
        }

        const newPos = typeof formatCoordinatePair === 'function'
            ? formatCoordinatePair(result.fixLat, result.fixLon)
            : `${result.fixLat.toFixed(5)}, ${result.fixLon.toFixed(5)}`;

        const warningsHtml = result.warnings.length
            ? `<div style="color:#ff9800; font-size:0.85em; margin-top:6px;">⚠ ${result.warnings.join('<br>⚠ ')}</div>`
            : '';

        out.innerHTML = `
            <strong>Observed Position (T₂)</strong>
            <div style="font-family: monospace; font-size: 0.95em; margin: 4px 0 8px;">${newPos}</div>
            <div style="font-size: 0.85em; line-height: 1.5; color: #555; border-top: 1px solid #bcd; padding-top: 8px;">
                ${result.steps.join('<br>')}
            </div>
            <div style="margin-top: 8px; font-size: 0.9em;">
                <strong>Run COG:</strong> ${result.runCog.toFixed(1)}° &nbsp;
                <strong>Run distance:</strong> ${result.runDistance.toFixed(2)} NM<br>
                <strong>Distance from object:</strong> ${result.fixDistanceFromObject.toFixed(2)} NM<br>
                <strong>Angle of cut:</strong> ${result.angleOfCut.toFixed(1)}°
            </div>
            ${warningsHtml}
        `;
    }

    function clearOutput() {
        const out = document.getElementById('runfixOut');
        if (out) {
            out.innerHTML = '';
            out.style.display = 'none';
        }
        ['runfixObjLat', 'runfixObjLon', 'runfixBearing1', 'runfixBearing2',
         'runfixCourse', 'runfixSpeed', 'runfixRunTime'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();