/**
 * Running Fix Calculator - Leaflet adapter (sea map).
 * Renders a floating control with an input form, calls window.RunFix.calculate(),
 * and shows the numeric result in the panel. Numbers-only: no plotting.
 */
(function() {
    'use strict';

    window.initRunFix = function(leafletMap) {
        L.Control.RunningFix = L.Control.extend({
            options: { position: 'bottomright' },
            onAdd: function() {
                const container = L.DomUtil.create('div', 'runfix-control');
                container.innerHTML = panelHtml();
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                setTimeout(wireUp, 100);
                return container;
            }
        });

        new L.Control.RunningFix().addTo(leafletMap);
    };

    function panelHtml() {
        return `
            <button id="runfixReopenBtn" type="button"
                    style="display:inline-block; background:#00838f; color:#fff; border:none; border-radius:20px;
                           box-shadow:0 1px 5px rgba(0,0,0,0.4); cursor:pointer; padding:8px 14px;
                           font-weight:600; font-size:13px;"
                    title="Show Running Fix panel">
                🧭 Run Fix
            </button>
            <div id="runfixPanel"
                 style="display:none; background:white; border:2px solid rgba(0,0,0,0.2);
                        border-radius:4px; box-shadow:0 1px 5px rgba(0,0,0,0.4); width:280px;
                        max-width: calc(100vw - 20px); max-height: 240px;
                        overflow-y: auto; box-sizing: border-box;">
                <div style="position: sticky; top: 0; background: white; z-index: 2;
                            padding: 10px 10px 6px 10px; border-bottom: 1px solid #eee;
                            display:flex; justify-content:space-between; align-items:center;">
                    <strong>🧭 Running Fix</strong>
                    <button id="runfixHideBtn" type="button"
                            style="background:none; border:none; cursor:pointer; font-size:16px; line-height:1;
                                   padding:2px 6px; color:#666;"
                            title="Hide panel">✕</button>
                </div>
                <div style="padding: 8px 10px 10px 10px; font-size: 11px;">
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Object Latitude:</div>
                        <input id="runfixObjLat" type="text" placeholder="54.5 or 54°22.5'N"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Object Longitude:</div>
                        <input id="runfixObjLon" type="text" placeholder="18.5 or 018°34.2'E"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">First bearing to object (°):</div>
                        <input id="runfixBearing1" type="number" min="0" max="360" step="0.1" placeholder="045"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Second bearing to object (°):</div>
                        <input id="runfixBearing2" type="number" min="0" max="360" step="0.1" placeholder="095"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Bearings are:</div>
                        <label style="margin-right:12px;"><input type="radio" name="runfixBearingType" value="compass" checked> Compass</label>
                        <label><input type="radio" name="runfixBearingType" value="true"> True</label>
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Course type:</div>
                        <label style="margin-right:12px;"><input type="radio" name="runfixCourseType" value="compass" checked> Compass</label>
                        <label><input type="radio" name="runfixCourseType" value="true"> True</label>
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Course / heading (°):</div>
                        <input id="runfixCourse" type="number" min="0" max="360" step="0.1" placeholder="050"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Magnetic Variation (° +E / −W):</div>
                        <input id="runfixVariation" type="number" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Compass Deviation (° +E / −W):</div>
                        <input id="runfixDeviation" type="number" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Leeway (° +stbd / −port):</div>
                        <input id="runfixLeeway" type="number" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Speed STW (knots):</div>
                        <input id="runfixSpeed" type="number" min="0" step="0.1" placeholder="6.0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Current Set (° true, toward):</div>
                        <input id="runfixCurrentSet" type="number" min="0" max="360" step="0.1" placeholder="0-360" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:6px;">
                        <div style="color:#555; margin-bottom:2px;">Current Drift (knots):</div>
                        <input id="runfixCurrentDrift" type="number" min="0" step="0.1" placeholder="0.0" value="0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <div style="margin-bottom:8px;">
                        <div style="color:#555; margin-bottom:2px;">Run time T₂−T₁ (hours):</div>
                        <input id="runfixRunTime" type="number" min="0" step="0.5" placeholder="2.0"
                               style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                    </div>
                    <button id="runfixCalcBtn"
                            style="width:100%; padding:6px; cursor:pointer; background:#00838f; color:white; border:none; border-radius:3px; font-weight:bold; margin-bottom:4px;">
                        Calculate Fix
                    </button>
                    <button id="runfixClearBtn"
                            style="width:100%; padding:5px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:3px; font-size:11px;">
                        Clear
                    </button>
                    <div id="runfixOut"
                         style="margin-top:8px; font-size:11px; font-family:monospace; line-height:1.4; min-height:30px; padding:6px; background:#f5f5f5; border-radius:3px; color:#333;">
                        Enter values and calculate
                    </div>
                </div>
            </div>
        `;
    }

    function wireUp() {
        const calcBtn = document.getElementById('runfixCalcBtn');
        const clearBtn = document.getElementById('runfixClearBtn');
        const hideBtn = document.getElementById('runfixHideBtn');
        const reopenBtn = document.getElementById('runfixReopenBtn');
        const panel = document.getElementById('runfixPanel');

        if (calcBtn) calcBtn.onclick = runCalculation;
        if (clearBtn) clearBtn.onclick = clearRunFix;

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
        if (!result.ok) {
            out.innerHTML = `<span style="color:#f44336;">⚠ ${result.error}</span>`;
            return;
        }

        const newPos = formatCoordinatePair(result.fixLat, result.fixLon);
        const warningsHtml = result.warnings.length
            ? `<div style="color:#ff9800; font-size:10px; margin-top:4px;">⚠ ${result.warnings.join('<br>⚠ ')}</div>`
            : '';

        out.innerHTML = `
            <div style="color:#155724;"><b>Observed Position (T₂):</b></div>
            <div><b>Fix:</b> ${newPos}</div>
            <div style="margin-top:6px; padding-top:6px; border-top:1px solid #ddd;">
                <div style="font-size:10px; margin:4px 0; padding:4px; background:#e0f7fa; border-radius:2px;">${result.steps.join('<br>')}</div>
                <b>Run COG:</b> ${result.runCog.toFixed(1)}° &nbsp;
                <b>Run dist:</b> ${result.runDistance.toFixed(2)} NM<br>
                <b>Angle of cut:</b> ${result.angleOfCut.toFixed(1)}° &nbsp;
                <b>From object:</b> ${result.fixDistanceFromObject.toFixed(2)} NM
                ${warningsHtml}
            </div>
        `;
    }

    function clearRunFix() {
        const out = document.getElementById('runfixOut');
        if (out) out.innerHTML = 'Enter values and calculate';
        ['runfixObjLat', 'runfixObjLon', 'runfixBearing1', 'runfixBearing2',
         'runfixCourse', 'runfixSpeed', 'runfixRunTime'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }
})();