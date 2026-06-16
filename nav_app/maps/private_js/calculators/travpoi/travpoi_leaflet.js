/**
 * Traverse POI Calculator - Leaflet adapter (sea map).
 * Renders a floating control with an input form, calls window.TravPOI.calculate(),
 * and shows the numeric result in the panel. Numbers-only: no plotting.
 */
(function() {
    'use strict';

    const FIELDS = ['travpoiShipLat', 'travpoiShipLon', 'travpoiPoiLat', 'travpoiPoiLon',
                    'travpoiCourse', 'travpoiSpeed'];

    window.initTravPOI = function(leafletMap) {
        L.Control.TraversePOI = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function() {
                const container = L.DomUtil.create('div', 'travpoi-control');
                container.innerHTML = panelHtml();
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                setTimeout(wireUp, 100);
                return container;
            }
        });

        new L.Control.TraversePOI().addTo(leafletMap);
    };

    function panelHtml() {
        return `
            <button id="travpoiReopenBtn" type="button"
                    style="display:inline-block; background:#5e35b1; color:#fff; border:none; border-radius:20px;
                           box-shadow:0 1px 5px rgba(0,0,0,0.4); cursor:pointer; padding:8px 14px;
                           font-weight:600; font-size:13px;"
                    title="Show Traverse POI panel">
                🎯 Travers POI
            </button>
            <div id="travpoiPanel"
                 style="display:none; background:white; border:2px solid rgba(0,0,0,0.2);
                        border-radius:4px; box-shadow:0 1px 5px rgba(0,0,0,0.4); width:280px;
                        max-width: calc(100vw - 20px); max-height: 240px;
                        overflow-y: auto; box-sizing: border-box;">
                <div style="position: sticky; top: 0; background: white; z-index: 2;
                            padding: 10px 10px 6px 10px; border-bottom: 1px solid #eee;
                            display:flex; justify-content:space-between; align-items:center;">
                    <strong>🎯 Travers POI</strong>
                    <button id="travpoiHideBtn" type="button"
                            style="background:none; border:none; cursor:pointer; font-size:16px; line-height:1;
                                   padding:2px 6px; color:#666;"
                            title="Hide panel">✕</button>
                </div>
                <div style="padding: 8px 10px 10px 10px; font-size: 11px;">
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Vessel Latitude:</div>
                        <input id="travpoiShipLat" type="text" placeholder="54.5 or 54°22.5'N"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Vessel Longitude:</div>
                        <input id="travpoiShipLon" type="text" placeholder="18.5 or 018°34.2'E"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">POI Latitude:</div>
                        <input id="travpoiPoiLat" type="text" placeholder="54.7 or 54°42.0'N"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">POI Longitude:</div>
                        <input id="travpoiPoiLon" type="text" placeholder="18.9 or 018°54.0'E"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">True course Kdd (0-359°):</div>
                        <input id="travpoiCourse" type="number" min="0" max="359" step="0.1" placeholder="050"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:8px;">
                        <div style="color:#555; margin-bottom:2px;">Speed (knots, optional):</div>
                        <input id="travpoiSpeed" type="number" min="0" step="0.1" placeholder="6.0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <button id="travpoiCalcBtn"
                            style="width:100%; padding:6px; cursor:pointer; background:#5e35b1; color:white; border:none; border-radius:3px; font-weight:bold; margin-bottom:4px;">
                        Calculate Traverse
                    </button>
                    <button id="travpoiClearBtn"
                            style="width:100%; padding:5px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:3px; font-size:11px;">
                        Clear
                    </button>
                    <div id="travpoiOut"
                         style="margin-top:8px; font-size:11px; font-family:monospace; line-height:1.4; min-height:30px; padding:6px; background:#f5f5f5; border-radius:3px; color:#333;">
                        Enter values and calculate
                    </div>
                </div>
            </div>
        `;
    }

    function wireUp() {
        const calcBtn = document.getElementById('travpoiCalcBtn');
        const clearBtn = document.getElementById('travpoiClearBtn');
        const hideBtn = document.getElementById('travpoiHideBtn');
        const reopenBtn = document.getElementById('travpoiReopenBtn');
        const panel = document.getElementById('travpoiPanel');

        if (calcBtn) calcBtn.onclick = runCalculation;
        if (clearBtn) clearBtn.onclick = clearTravPOI;

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
        if (!result.ok) {
            out.innerHTML = `<span style="color:#f44336;">⚠ ${result.error}</span>`;
            return;
        }

        const travPos = formatCoordinatePair(result.travLat, result.travLon);
        const sideLabel = result.side === 'starboard' ? 'STARBOARD (right)' : 'PORT (left)';
        const timeHtml = result.timeText
            ? `<br><b>Time to traverse:</b> ${result.timeText}`
            : '';
        const warningsHtml = result.warnings.length
            ? `<div style="color:#ff9800; font-size:10px; margin-top:4px;">⚠ ${result.warnings.join('<br>⚠ ')}</div>`
            : '';

        out.innerHTML = `
            <div style="color:#311b92;"><b>Traverse Point (POI abeam):</b></div>
            <div><b>Point:</b> ${travPos}</div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px solid #ddd;">
                <div style="font-size:10px; margin:4px 0; padding:4px; background:#ede7f6; border-radius:2px;">${result.steps.join('<br>')}</div>
                <b>Distance:</b> ${result.alongDistance.toFixed(2)} NM${result.behind ? ' (astern)' : ''} &nbsp;
                <b>Beam dist:</b> ${result.beamDistance.toFixed(2)} NM<br>
                <b>POI on:</b> ${sideLabel} beam${timeHtml}
                ${warningsHtml}
            </div>
        `;
    }

    function clearTravPOI() {
        const out = document.getElementById('travpoiOut');
        if (out) out.innerHTML = 'Enter values and calculate';
        FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
})();