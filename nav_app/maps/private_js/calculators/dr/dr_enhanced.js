/**
 * Dead Reckoning Calculator - Enhanced Graticule adapter.
 * Reads inputs from the sidebar panel, calls window.DR.calculate,
 * and shows the computed position + ground-track numbers in #drOut.
 * Numbers-only: does not plot on the canvas.
 */
(function() {
    'use strict';

    function init() {
        const calcBtn = document.getElementById('drCalcBtn');
        if (!calcBtn) return; // panel not on this page

        calcBtn.addEventListener('click', runCalculation);

        const clearBtn = document.getElementById('drClearBtn');
        if (clearBtn) clearBtn.addEventListener('click', clearOutput);

        ['drStartLat', 'drStartLon', 'drCourse', 'drVariation', 'drDeviation', 'drLeeway',
         'drSpeed', 'drCurrentSet', 'drCurrentDrift', 'drTime'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keypress', e => {
                    if (e.key === 'Enter') runCalculation();
                });
            }
        });

        DR.bindCourseTypeToggle('drCourseType');
    }

    function runCalculation() {
        const out = document.getElementById('drOut');
        const courseTypeEl = document.querySelector('input[name="drCourseType"]:checked');

        const input = {
            startLat: DR.parseCoord(document.getElementById('drStartLat').value),
            startLon: DR.parseCoord(document.getElementById('drStartLon').value),
            course: parseFloat(document.getElementById('drCourse').value),
            courseType: courseTypeEl ? courseTypeEl.value : 'compass',
            variation: parseFloat(document.getElementById('drVariation').value) || 0,
            deviation: parseFloat(document.getElementById('drDeviation').value) || 0,
            leeway: parseFloat(document.getElementById('drLeeway').value) || 0,
            speed: parseFloat(document.getElementById('drSpeed').value),
            currentSet: parseFloat(document.getElementById('drCurrentSet').value) || 0,
            currentDrift: parseFloat(document.getElementById('drCurrentDrift').value) || 0,
            time: parseFloat(document.getElementById('drTime').value)
        };

        const result = DR.calculate(input);
        out.style.display = 'block';

        if (!result.ok) {
            out.innerHTML = `<strong style="color:#d32f2f;">⚠ ${result.error}</strong>`;
            return;
        }

        const newPos = typeof formatCoordinatePair === 'function'
            ? formatCoordinatePair(result.newLat, result.newLon)
            : `${result.newLat.toFixed(5)}, ${result.newLon.toFixed(5)}`;

        out.innerHTML = `
            <strong>DR Position</strong>
            <div style="font-family: monospace; font-size: 0.95em; margin: 4px 0 8px;">${newPos}</div>
            <div style="font-size: 0.85em; line-height: 1.5; color: #555; border-top: 1px solid #bcd; padding-top: 8px;">
                ${result.steps.join('<br>')}
            </div>
            <div style="margin-top: 8px; font-size: 0.9em;">
                <strong>COG:</strong> ${result.cog.toFixed(1)}° &nbsp;
                <strong>SOG:</strong> ${result.sog.toFixed(2)} kts<br>
                <strong>Ground Distance:</strong> ${result.distance.toFixed(2)} NM<br>
                <strong>Time:</strong> ${input.time.toFixed(1)} h
            </div>
        `;
    }

    function clearOutput() {
        const out = document.getElementById('drOut');
        if (out) {
            out.innerHTML = '';
            out.style.display = 'none';
        }
        ['drStartLat', 'drStartLon', 'drCourse', 'drSpeed', 'drTime'].forEach(id => {
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
