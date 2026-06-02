/**
 * Two-Bearing Fix Calculator - Enhanced Graticule adapter.
 * Reads inputs from the sidebar panel, calls window.Fix.calculate,
 * and shows the computed position + diagnostic numbers in #fixOut.
 */
(function() {
    'use strict';

    function init() {
        const calcBtn = document.getElementById('fixCalcBtn');
        if (!calcBtn) return; // panel not on this page

        calcBtn.addEventListener('click', runCalculation);

        const clearBtn = document.getElementById('fixClearBtn');
        if (clearBtn) clearBtn.addEventListener('click', clearOutput);

        ['fixObjALat', 'fixObjALon', 'fixObjBLat', 'fixObjBLon',
         'fixBearingA', 'fixBearingB', 'fixDeviation', 'fixVariation'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keypress', e => {
                    if (e.key === 'Enter') runCalculation();
                });
            }
        });
    }

    function runCalculation() {
        const out = document.getElementById('fixOut');
        const input = {
            objALat: Fix.parseCoord(document.getElementById('fixObjALat').value),
            objALon: Fix.parseCoord(document.getElementById('fixObjALon').value),
            objBLat: Fix.parseCoord(document.getElementById('fixObjBLat').value),
            objBLon: Fix.parseCoord(document.getElementById('fixObjBLon').value),
            bearingA: parseFloat(document.getElementById('fixBearingA').value),
            bearingB: parseFloat(document.getElementById('fixBearingB').value),
            deviation: parseFloat(document.getElementById('fixDeviation').value) || 0,
            variation: parseFloat(document.getElementById('fixVariation').value) || 0
        };

        const result = Fix.calculate(input);
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
            <strong>Observed Position</strong>
            <div style="font-family: monospace; font-size: 0.95em; margin: 4px 0 8px;">${newPos}</div>
            <div style="font-size: 0.85em; line-height: 1.5; color: #555; border-top: 1px solid #bcd; padding-top: 8px;">
                ${result.steps.join('<br>')}
            </div>
            <div style="margin-top: 8px; font-size: 0.9em;">
                <strong>Distance from A:</strong> ${result.distFromA.toFixed(2)} NM<br>
                <strong>Distance from B:</strong> ${result.distFromB.toFixed(2)} NM<br>
                <strong>Angle of cut:</strong> ${result.angleOfCut.toFixed(1)}°
            </div>
            ${warningsHtml}
        `;
    }

    function clearOutput() {
        const out = document.getElementById('fixOut');
        if (out) {
            out.innerHTML = '';
            out.style.display = 'none';
        }
        ['fixObjALat', 'fixObjALon', 'fixObjBLat', 'fixObjBLon', 'fixBearingA', 'fixBearingB'].forEach(id => {
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