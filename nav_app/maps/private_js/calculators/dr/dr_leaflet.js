/**
 * Dead Reckoning Calculator - Leaflet adapter (sea map).
 * Renders a floating control with an input form, calls window.DR.calculate(),
 * and draws start/water/current/ground tracks plus a DR position marker.
 */
(function() {
    'use strict';

    let map = null;
    let drLayer = null;

    window.initDeadReckoning = function(leafletMap) {
        map = leafletMap;
        drLayer = L.layerGroup().addTo(map);

        L.Control.DeadReckoning = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function() {
                const container = L.DomUtil.create('div', 'dr-control');
                container.innerHTML = panelHtml();
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                setTimeout(wireUp, 100);
                return container;
            }
        });

        new L.Control.DeadReckoning().addTo(map);
    };

    function panelHtml() {
        return `
            <button id="drReopenBtn" type="button"
                    style="display:inline-block; background:#1976d2; color:#fff; border:none; border-radius:20px;
                           box-shadow:0 1px 5px rgba(0,0,0,0.4); cursor:pointer; padding:8px 14px;
                           font-weight:600; font-size:13px;"
                    title="Show Dead Reckoning panel">
                ⚓ DR
            </button>
            <div id="drPanel"
                 style="display:none; background:white; border:2px solid rgba(0,0,0,0.2);
                        border-radius:4px; box-shadow:0 1px 5px rgba(0,0,0,0.4); width:280px;
                        max-width: calc(100vw - 20px); max-height: 240px;
                        overflow-y: auto; box-sizing: border-box;">
                <div style="position: sticky; top: 0; background: white; z-index: 2;
                            padding: 10px 10px 6px 10px; border-bottom: 1px solid #eee;
                            display:flex; justify-content:space-between; align-items:center;">
                    <strong>⚓ Dead Reckoning</strong>
                    <button id="drHideBtn" type="button"
                            style="background:none; border:none; cursor:pointer; font-size:16px; line-height:1;
                                   padding:2px 6px; color:#666;"
                            title="Hide panel">✕</button>
                </div>
                <div style="padding: 8px 10px 10px 10px; font-size: 11px;">
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Start Latitude:</div>
                        <input id="drStartLat" type="text" placeholder="54.5 or 54°22.5'N"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Start Longitude:</div>
                        <input id="drStartLon" type="text" placeholder="18.5 or 018°34.2'E"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Course type:</div>
                        <label style="margin-right:12px;"><input type="radio" name="drCourseType" value="compass" checked> Compass</label>
                        <label><input type="radio" name="drCourseType" value="true"> True</label>
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Course (°):</div>
                        <input id="drCourse" type="number" min="0" max="360" step="0.1" placeholder="045"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Magnetic Variation (° +E / −W):</div>
                        <input id="drVariation" type="number" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Compass Deviation (° +E / −W):</div>
                        <input id="drDeviation" type="number" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Leeway (° +stbd / −port):</div>
                        <input id="drLeeway" type="number" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Speed STW (knots):</div>
                        <input id="drSpeed" type="number" min="0" step="0.1" placeholder="5.0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Current Set (° true, toward):</div>
                        <input id="drCurrentSet" type="number" min="0" max="360" step="0.1" placeholder="0-360" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Current Drift (knots):</div>
                        <input id="drCurrentDrift" type="number" min="0" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:8px;">
                        <div style="color:#555; margin-bottom:2px;">Time (hours):</div>
                        <input id="drTime" type="number" min="0" step="0.5" placeholder="2.0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <button id="drCalc"
                            style="width:100%; padding:6px; cursor:pointer; background:#4CAF50; color:white; border:none; border-radius:3px; font-weight:bold; margin-bottom:4px;">
                        Calculate Position
                    </button>
                    <button id="drClear"
                            style="width:100%; padding:5px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:3px; font-size:11px;">
                        Clear
                    </button>
                    <div id="drOut"
                         style="margin-top:8px; font-size:11px; font-family:monospace; line-height:1.4; min-height:30px; padding:6px; background:#f5f5f5; border-radius:3px; color:#333;">
                        Enter values and calculate
                    </div>
                </div>
            </div>
        `;
    }

    function wireUp() {
        const calcBtn = document.getElementById('drCalc');
        const clearBtn = document.getElementById('drClear');
        const hideBtn = document.getElementById('drHideBtn');
        const reopenBtn = document.getElementById('drReopenBtn');
        const panel = document.getElementById('drPanel');

        if (calcBtn) calcBtn.onclick = runCalculation;
        if (clearBtn) clearBtn.onclick = clearDR;

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
        const input = {
            startLat: DR.parseCoord(document.getElementById('drStartLat').value),
            startLon: DR.parseCoord(document.getElementById('drStartLon').value),
            course: parseFloat(document.getElementById('drCourse').value),
            courseType: document.querySelector('input[name="drCourseType"]:checked').value,
            variation: parseFloat(document.getElementById('drVariation').value) || 0,
            deviation: parseFloat(document.getElementById('drDeviation').value) || 0,
            leeway: parseFloat(document.getElementById('drLeeway').value) || 0,
            speed: parseFloat(document.getElementById('drSpeed').value),
            currentSet: parseFloat(document.getElementById('drCurrentSet').value) || 0,
            currentDrift: parseFloat(document.getElementById('drCurrentDrift').value) || 0,
            time: parseFloat(document.getElementById('drTime').value)
        };

        const result = DR.calculate(input);
        if (!result.ok) {
            out.innerHTML = `<span style="color:#f44336;">⚠ ${result.error}</span>`;
            return;
        }

        const newPos = formatCoordinatePair(result.newLat, result.newLon);
        out.innerHTML = `
            <div style="color:#155724;"><b>DR Position:</b></div>
            <div><b>New Pos:</b> ${newPos}</div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px solid #ddd;">
                <div style="font-size:10px; margin:4px 0; padding:4px; background:#e3f2fd; border-radius:2px;">${result.steps.join('<br>')}</div>
                <b>COG:</b> ${result.cog.toFixed(1)}° &nbsp; <b>SOG:</b> ${result.sog.toFixed(2)} kts<br>
                <b>Ground Dist:</b> ${result.distance.toFixed(2)} NM<br>
                <b>Time:</b> ${input.time.toFixed(1)}h
            </div>
        `;
    }

    function clearDR() {
        if (drLayer) drLayer.clearLayers();
        const out = document.getElementById('drOut');
        if (out) out.innerHTML = 'Enter values and calculate';
        const lat = document.getElementById('drStartLat');
        const lon = document.getElementById('drStartLon');
        if (lat) lat.value = '';
        if (lon) lon.value = '';
    }
})();
