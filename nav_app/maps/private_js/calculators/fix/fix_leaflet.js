/**
 * Two-Bearing Fix Calculator - Leaflet adapter (sea map).
 * Renders a floating control with an input form, calls window.Fix.calculate(),
 * and shows the numeric result in the panel.
 */
(function() {
    'use strict';

    window.initFix = function(leafletMap) {
        L.Control.TwoBearingFix = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function() {
                const container = L.DomUtil.create('div', 'fix-control');
                container.innerHTML = panelHtml();
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                setTimeout(wireUp, 100);
                return container;
            }
        });

        new L.Control.TwoBearingFix().addTo(leafletMap);
    };

    function panelHtml() {
        return `
            <button id="fixReopenBtn" type="button"
                    style="display:inline-block; background:#9c27b0; color:#fff; border:none; border-radius:20px;
                           box-shadow:0 1px 5px rgba(0,0,0,0.4); cursor:pointer; padding:8px 14px;
                           font-weight:600; font-size:13px;"
                    title="Show Two-Bearing Fix panel">
                📍 Fix
            </button>
            <div id="fixPanel"
                 style="display:none; background:white; border:2px solid rgba(0,0,0,0.2);
                        border-radius:4px; box-shadow:0 1px 5px rgba(0,0,0,0.4); width:280px;
                        max-width: calc(100vw - 20px); max-height: 240px;
                        overflow-y: auto; box-sizing: border-box;">
                <div style="position: sticky; top: 0; background: white; z-index: 2;
                            padding: 10px 10px 6px 10px; border-bottom: 1px solid #eee;
                            display:flex; justify-content:space-between; align-items:center;">
                    <strong>📍 Two-Bearing Fix</strong>
                    <button id="fixHideBtn" type="button"
                            style="background:none; border:none; cursor:pointer; font-size:16px; line-height:1;
                                   padding:2px 6px; color:#666;"
                            title="Hide panel">✕</button>
                </div>
                <div style="padding: 8px 10px 10px 10px; font-size: 11px;">
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Object A Latitude:</div>
                        <input id="fixObjALat" type="text" placeholder="54.5 or 54°22.5'N"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Object A Longitude:</div>
                        <input id="fixObjALon" type="text" placeholder="18.5 or 018°34.2'E"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Object B Latitude:</div>
                        <input id="fixObjBLat" type="text" placeholder="54.6 or 54°36.0'N"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Object B Longitude:</div>
                        <input id="fixObjBLon" type="text" placeholder="18.8 or 018°48.0'E"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Compass Bearing to A (°):</div>
                        <input id="fixBearingA" type="number" min="0" max="360" step="0.1" placeholder="045"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Compass Bearing to B (°):</div>
                        <input id="fixBearingB" type="number" min="0" max="360" step="0.1" placeholder="110"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Compass Deviation (° +E / −W):</div>
                        <input id="fixDeviation" type="number" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:8px;">
                        <div style="color:#555; margin-bottom:2px;">Magnetic Variation (° +E / −W):</div>
                        <input id="fixVariation" type="number" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <button id="fixCalcBtn"
                            style="width:100%; padding:6px; cursor:pointer; background:#9c27b0; color:white; border:none; border-radius:3px; font-weight:bold; margin-bottom:4px;">
                        Calculate Fix
                    </button>
                    <button id="fixClearBtn"
                            style="width:100%; padding:5px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:3px; font-size:11px;">
                        Clear
                    </button>
                    <div id="fixOut"
                         style="margin-top:8px; font-size:11px; font-family:monospace; line-height:1.4; min-height:30px; padding:6px; background:#f5f5f5; border-radius:3px; color:#333;">
                        Enter values and calculate
                    </div>
                </div>
            </div>
        `;
    }

    function wireUp() {
        const calcBtn = document.getElementById('fixCalcBtn');
        const clearBtn = document.getElementById('fixClearBtn');
        const hideBtn = document.getElementById('fixHideBtn');
        const reopenBtn = document.getElementById('fixReopenBtn');
        const panel = document.getElementById('fixPanel');

        if (calcBtn) calcBtn.onclick = runCalculation;
        if (clearBtn) clearBtn.onclick = clearFix;

        if (hideBtn && reopenBtn && panel) {
            hideBtn.onclick = () => {
                panel.style.display = 'none';
                reopenBtn.style.display = 'inline-block';
            };
            reopenBtn.onclick = () => {
                panel.style.display = 'block';
                reopenBtn.style.display = 'none';
            };
        }

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
        if (!result.ok) {
            out.innerHTML = `<span style="color:#f44336;">⚠ ${result.error}</span>`;
            return;
        }

        const newPos = formatCoordinatePair(result.fixLat, result.fixLon);
        const warningsHtml = result.warnings.length
            ? `<div style="color:#ff9800; font-size:10px; margin-top:4px;">⚠ ${result.warnings.join('<br>⚠ ')}</div>`
            : '';

        out.innerHTML = `
            <div style="color:#155724;"><b>Observed Position:</b></div>
            <div><b>Fix:</b> ${newPos}</div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px solid #ddd;">
                <div style="font-size:10px; margin:4px 0; padding:4px; background:#f3e5f5; border-radius:2px;">${result.steps.join('<br>')}</div>
                <b>Dist from A:</b> ${result.distFromA.toFixed(2)} NM &nbsp;
                <b>Dist from B:</b> ${result.distFromB.toFixed(2)} NM<br>
                <b>Angle of cut:</b> ${result.angleOfCut.toFixed(1)}°
                ${warningsHtml}
            </div>
        `;
    }

    function clearFix() {
        const out = document.getElementById('fixOut');
        if (out) out.innerHTML = 'Enter values and calculate';
        ['fixObjALat', 'fixObjALon', 'fixObjBLat', 'fixObjBLon', 'fixBearingA', 'fixBearingB'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
})();
