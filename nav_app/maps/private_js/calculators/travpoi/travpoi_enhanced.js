/**
 * Traverse POI Calculator - Enhanced Graticule adapter.
 * Reads inputs from the sidebar panel, calls window.TravPOI.calculate,
 * and shows the traverse point + diagnostic numbers in #travpoiOut.
 * Numbers-only: does not plot on the canvas.
 */
(function() {
    'use strict';

    const FIELDS = ['travpoiShipLat', 'travpoiShipLon', 'travpoiPoiLat', 'travpoiPoiLon',
                    'travpoiCourse', 'travpoiSpeed'];

    function init() {
        const calcBtn = document.getElementById('travpoiCalcBtn');
        if (!calcBtn) return; // panel not on this page

        calcBtn.addEventListener('click', runCalculation);

        const clearBtn = document.getElementById('travpoiClearBtn');
        if (clearBtn) clearBtn.addEventListener('click', clearOutput);

        FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keypress', e => {
                    if (e.key === 'Enter') runCalculation();
                });
            }
        });
    }

    function readInput() {
        return {
            shipLat: TravPOI.parseCoord(document.getElementById('travpoiShipLat').value),
            shipLon: TravPOI.parseCoord(document.getElementById('travpoiShipLon').value),
            poiLat: TravPOI.parseCoord(document.getElementById('travpoiPoiLat').value),
            poiLon: TravPOI.parseCoord(document.getElementById('travpoiPoiLon').value),
            course: parseFloat(document.getElementById('travpoiCourse').value),
            speed: parseFloat(document.getElementById('travpoiSpeed').value)
        };
    }

    function runCalculation() {
        const out = document.getElementById('travpoiOut');
        const result = TravPOI.calculate(readInput());
        out.style.display = 'block';

        if (!result.ok) {
            out.innerHTML = `<strong style="color:#d32f2f;">⚠ ${result.error}</strong>`;
            return;
        }

        const travPos = typeof formatCoordinatePair === 'function'
            ? formatCoordinatePair(result.travLat, result.travLon)
            : `${result.travLat.toFixed(5)}, ${result.travLon.toFixed(5)}`;

        const sideLabel = result.side === 'starboard' ? 'STARBOARD (right)' : 'PORT (left)';
        const timeHtml = result.timeText
            ? `<br><strong>Time to traverse:</strong> ${result.timeText}`
            : '';

        const warningsHtml = result.warnings.length
            ? `<div style="color:#ff9800; font-size:0.85em; margin-top:6px;">⚠ ${result.warnings.join('<br>⚠ ')}</div>`
            : '';

        out.innerHTML = `
            <strong>Traverse Point (POI abeam)</strong>
            <div style="font-family: monospace; font-size: 0.95em; margin: 4px 0 8px;">${travPos}</div>
            <div style="font-size: 0.85em; line-height: 1.5; color: #555; border-top: 1px solid #bcd; padding-top: 8px;">
                ${result.steps.join('<br>')}
            </div>
            <div style="margin-top: 8px; font-size: 0.9em;">
                <strong>Distance to traverse:</strong> ${result.alongDistance.toFixed(2)} NM${result.behind ? ' (astern)' : ''}<br>
                <strong>POI on:</strong> ${sideLabel} beam${timeHtml}<br>
                <strong>Beam distance:</strong> ${result.beamDistance.toFixed(2)} NM
            </div>
            ${warningsHtml}
        `;
    }

    function clearOutput() {
        const out = document.getElementById('travpoiOut');
        if (out) {
            out.innerHTML = '';
            out.style.display = 'none';
        }
        FIELDS.forEach(id => {
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