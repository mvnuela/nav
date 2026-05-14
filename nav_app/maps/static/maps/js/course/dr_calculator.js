/**
 * Dead Reckoning Calculator Module
 * Calculates new position based on initial position, course, speed, and time
 */

(function() {
    'use strict';

    let map = null;
    let drLayer = null;

    /**
     * Initialize Dead Reckoning calculator on the map
     * @param {L.Map} leafletMap - The Leaflet map instance
     */
    window.initDeadReckoning = function(leafletMap) {
        map = leafletMap;
        drLayer = L.layerGroup().addTo(map);

        // Create custom control
        L.Control.DeadReckoning = L.Control.extend({
            options: {
                position: 'bottomright'
            },

            onAdd: function() {
                const container = L.DomUtil.create('div', 'dr-control');
                container.style.background = 'white';
                container.style.padding = '10px';
                container.style.border = '2px solid rgba(0,0,0,0.2)';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                container.style.width = '280px';

                container.innerHTML = `
                    <div style="margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;">
                        <strong>⚓ Dead Reckoning</strong>
                        <button id="drToggle" style="background:none; border:none; cursor:pointer; font-size:14px; padding:0 4px;" title="Hide/Show Panel">
                            ▼
                        </button>
                    </div>
                    <div id="drPanelContent">
                    <table style="width:100%; font-size:12px;">
                        <tr>
                            <td style="padding:4px 0;">Start Latitude:</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drStartLat"
                                       type="text"
                                       placeholder="54.5 or 54°22.5'N"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Start Longitude:</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drStartLon"
                                       type="text"
                                       placeholder="18.5 or 018°34.2'E"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px; font-size:11px;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">
                                <label>
                                    <input type="radio" name="courseType" value="compass" checked style="margin-right:4px;" />
                                    Compass Course (°):
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drCourse"
                                       type="number"
                                       min="0"
                                       max="360"
                                       step="0.1"
                                       placeholder="045"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:2px 0; font-size:10px;">
                                <label>
                                    <input type="radio" name="courseType" value="true" style="margin-right:4px;" />
                                    True Course
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Magnetic Variation (°):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drDeclination"
                                       type="number"
                                       step="0.1"
                                       placeholder="0.0 (+E, -W)"
                                       value="0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                                <small style="color:#666; font-size:10px;">+East / -West</small>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Compass Deviation (°):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drDeviation"
                                       type="number"
                                       step="0.1"
                                       placeholder="0.0 (+E, -W)"
                                       value="0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                                <small style="color:#666; font-size:10px;">From deviation table</small>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Leeway (°):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drLeeway"
                                       type="number"
                                       step="0.1"
                                       placeholder="0.0 (+stbd, -port)"
                                       value="0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                                <small style="color:#666; font-size:10px;">+Starboard / -Port (wind drift)</small>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Boat Speed (knots, STW):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drSpeed"
                                       type="number"
                                       min="0"
                                       step="0.1"
                                       placeholder="5.0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                                <small style="color:#666; font-size:10px;">Speed through water</small>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:6px 0 2px 0; border-top:1px solid #eee;">
                                <strong style="font-size:11px;">Sea Current</strong>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Current Set (° true, toward):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drCurrentSet"
                                       type="number"
                                       min="0"
                                       max="360"
                                       step="0.1"
                                       placeholder="0-360"
                                       value="0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                                <small style="color:#666; font-size:10px;">Direction current flows TO</small>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Current Drift (knots):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drCurrentDrift"
                                       type="number"
                                       min="0"
                                       step="0.1"
                                       placeholder="0.0"
                                       value="0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0; border-top:1px solid #eee;">Time (hours):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drTime"
                                       type="number"
                                       min="0"
                                       step="0.5"
                                       placeholder="2.0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                            </td>
                        </tr>
                    </table>
                    <button id="drCalc" 
                            style="width:100%; padding:6px; margin-top:8px; cursor:pointer; background:#4CAF50; color:white; border:none; border-radius:3px; font-weight:bold;">
                        Calculate Position
                    </button>
                    <button id="drClear" 
                            style="width:100%; padding:5px; margin-top:5px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:3px; font-size:11px;">
                        Clear
                    </button>
                    <div id="drOut" 
                         style="margin-top:10px; font-size:12px; font-family:monospace; line-height:1.6; min-height:40px; padding:8px; background:#f5f5f5; border-radius:3px; color:#333;">
                        Enter values and calculate
                   </div>
                   </div>
               `;

                L.DomEvent.disableClickPropagation(container);

                // Initialize buttons after DOM is ready
                setTimeout(() => {
                    const calcBtn = document.getElementById('drCalc');
                    const clearBtn = document.getElementById('drClear');
                    const toggleBtn = document.getElementById('drToggle');
                    const panelContent = document.getElementById('drPanelContent');
                    
                    if (calcBtn) {
                        calcBtn.onclick = calculateDeadReckoning;
                    }
                    
                    if (clearBtn) {
                        clearBtn.onclick = clearDR;
                    }
                    
                    // Toggle panel visibility
                    if (toggleBtn && panelContent) {
                        toggleBtn.onclick = function() {
                            if (panelContent.style.display === 'none') {
                                panelContent.style.display = 'block';
                                toggleBtn.textContent = '▼';
                                toggleBtn.title = 'Hide Panel';
                            } else {
                                panelContent.style.display = 'none';
                                toggleBtn.textContent = '▶';
                                toggleBtn.title = 'Show Panel';
                            }
                        };
                    }

                    // Allow Enter key to trigger calculation
                    ['drStartLat', 'drStartLon', 'drCourse', 'drDeclination', 'drDeviation', 'drLeeway', 'drSpeed', 'drCurrentSet', 'drCurrentDrift', 'drTime'].forEach(id => {
                        const input = document.getElementById(id);
                        if (input) {
                            input.addEventListener('keypress', function(e) {
                                if (e.key === 'Enter') {
                                    calculateDeadReckoning();
                                }
                            });
                        }
                    });
                }, 100);

                return container;
            }
        });

        // Add control to map
        new L.Control.DeadReckoning().addTo(map);
    };

    /**
     * Calculate dead reckoning position
     */
    function calculateDeadReckoning() {
        const outputElement = document.getElementById('drOut');
        
        try {
            // Get input values
            const latInput = document.getElementById('drStartLat').value.trim();
            const lonInput = document.getElementById('drStartLon').value.trim();
            const courseInput = parseFloat(document.getElementById('drCourse').value);
            const declination = parseFloat(document.getElementById('drDeclination').value) || 0;
            const deviation = parseFloat(document.getElementById('drDeviation').value) || 0;
            const leeway = parseFloat(document.getElementById('drLeeway').value) || 0;
            const speed = parseFloat(document.getElementById('drSpeed').value);
            const currentSet = parseFloat(document.getElementById('drCurrentSet').value) || 0;
            const currentDrift = parseFloat(document.getElementById('drCurrentDrift').value) || 0;
            const time = parseFloat(document.getElementById('drTime').value);
            
            // Get course type
            const courseType = document.querySelector('input[name="courseType"]:checked').value;

            // Validate inputs
            if (!latInput || !lonInput) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Please enter start position</span>';
                return;
            }

            if (isNaN(courseInput) || courseInput < 0 || courseInput > 360) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Course must be 0-360°</span>';
                return;
            }

            if (isNaN(speed) || speed < 0) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Speed must be positive</span>';
                return;
            }

            if (isNaN(time) || time < 0) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Time must be positive</span>';
                return;
            }

            if (currentSet < 0 || currentSet > 360) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Current set must be 0-360°</span>';
                return;
            }

            if (currentDrift < 0) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Current drift must be ≥ 0</span>';
                return;
            }

            // Build true heading from compass chain, then CTW from leeway
            let trueHeading, magneticHeading, compassHeading;
            let courseSteps = [];

            if (courseType === 'compass') {
                // Compass → Magnetic → True (CADET: Compass +Deviation = Magnetic +Variation = True)
                compassHeading = courseInput;
                magneticHeading = normalize(compassHeading + deviation);
                trueHeading = normalize(magneticHeading + declination);

                courseSteps.push(`Compass HDG: ${compassHeading.toFixed(1)}°`);
                if (deviation !== 0) {
                    courseSteps.push(`+ Deviation ${deviation.toFixed(1)}° → Magnetic ${magneticHeading.toFixed(1)}°`);
                }
                if (declination !== 0) {
                    courseSteps.push(`+ Variation ${declination.toFixed(1)}° → True HDG ${trueHeading.toFixed(1)}°`);
                }
                if (deviation === 0 && declination === 0) {
                    courseSteps.push(`True HDG: ${trueHeading.toFixed(1)}°`);
                }
            } else {
                // Already a true heading
                trueHeading = courseInput;
                courseSteps.push(`True HDG: ${trueHeading.toFixed(1)}°`);
            }

            // Course Through Water = True heading + leeway
            const ctw = normalize(trueHeading + leeway);
            if (leeway !== 0) {
                courseSteps.push(`+ Leeway ${leeway.toFixed(1)}° → CTW ${ctw.toFixed(1)}°`);
            }

            // Parse starting position - accept both decimal and nautical formats
            let lat, lon;

            // Parse latitude - accept both formats
            if (latInput.includes('°') || latInput.includes('\'')) {
                // Nautical format
                lat = nauticalToDecimal(latInput);
            } else {
                // Decimal format
                lat = parseFloat(latInput);
            }

            // Parse longitude - accept both formats
            if (lonInput.includes('°') || lonInput.includes('\'')) {
                // Nautical format
                lon = nauticalToDecimal(lonInput);
            } else {
                // Decimal format
                lon = parseFloat(lonInput);
            }

            if (isNaN(lat) || isNaN(lon) || lat === null || lon === null) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Invalid coordinate format</span>';
                return;
            }

            if (lat < -90 || lat > 90) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Latitude must be -90 to 90</span>';
                return;
            }

            if (lon < -180 || lon > 180) {
                outputElement.innerHTML = '<span style="color:#f44336;">⚠ Longitude must be -180 to 180</span>';
                return;
            }

            // Vector through water: distance = STW × time in CTW direction
            const waterDist = speed * time;
            const ctwRad = ctw * Math.PI / 180;
            const waterN = waterDist * Math.cos(ctwRad);
            const waterE = waterDist * Math.sin(ctwRad);

            // Current vector: drift × time in Set direction (Set = direction current flows TO)
            const currentDist = currentDrift * time;
            const setRad = currentSet * Math.PI / 180;
            const currentN = currentDist * Math.cos(setRad);
            const currentE = currentDist * Math.sin(setRad);

            // Ground vector = water vector + current vector
            const groundN = waterN + currentN;
            const groundE = waterE + currentE;

            const distance = Math.sqrt(groundN * groundN + groundE * groundE);
            const cog = distance > 1e-9 ? normalize(Math.atan2(groundE, groundN) * 180 / Math.PI) : ctw;
            const sog = time > 0 ? distance / time : 0;

            if (currentDrift !== 0) {
                courseSteps.push(`+ Current ${currentSet.toFixed(1)}°/${currentDrift.toFixed(1)}kt → COG ${cog.toFixed(1)}° / SOG ${sog.toFixed(2)}kt`);
            }

            // Change in latitude and longitude from ground vector (NM → degrees)
            const dLat = groundN / 60;
            const dLon = groundE / (60 * Math.cos(lat * Math.PI / 180));

            const newLat = lat + dLat;
            const newLon = lon + dLon;

            // Clear and redraw on layer
            if (drLayer) {
                drLayer.clearLayers();
            }

            // Start position
            const startPos = {lat: lat, lng: lon};

            // Start marker
            const startMarker = L.circleMarker(startPos, {
                radius: 8,
                fillColor: '#17a2b8',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(drLayer);
            startMarker.bindPopup(`<b>Start</b><br>${formatCoordinatePair(lat, lon)}`);

            // DR position
            const drPosition = {lat: newLat, lng: newLon};

            // If there's a current, show the water track (heading + leeway) as a separate leg
            if (currentDrift !== 0) {
                const waterEndLat = lat + waterN / 60;
                const waterEndLon = lon + waterE / (60 * Math.cos(lat * Math.PI / 180));
                const waterEnd = {lat: waterEndLat, lng: waterEndLon};

                const waterLine = L.polyline([startPos, waterEnd], {
                    color: '#1976d2',
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '4, 6'
                }).addTo(drLayer);
                waterLine.bindPopup(`<b>Water Track</b><br>CTW: ${ctw.toFixed(1)}°<br>STW: ${speed} kts<br>Dist: ${waterDist.toFixed(2)} NM`);

                const currentLine = L.polyline([waterEnd, drPosition], {
                    color: '#9c27b0',
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '2, 4'
                }).addTo(drLayer);
                currentLine.bindPopup(`<b>Current Set</b><br>${currentSet.toFixed(1)}° @ ${currentDrift.toFixed(1)} kts<br>Dist: ${currentDist.toFixed(2)} NM`);
            }

            // Ground track (COG)
            const courseLine = L.polyline([startPos, drPosition], {
                color: '#28a745',
                weight: 3,
                opacity: 0.8,
                dashArray: '10, 10'
            }).addTo(drLayer);

            const courseInfo = courseSteps.join('<br>');
            courseLine.bindPopup(`<b>DR Ground Track</b><br>${courseInfo}<br>COG: ${cog.toFixed(1)}°<br>SOG: ${sog.toFixed(2)} kts<br>Time: ${time.toFixed(1)}h<br>Distance: ${distance.toFixed(2)} NM`);

            // DR position marker
            const drMarker = L.circleMarker(drPosition, {
                radius: 10,
                fillColor: '#ffc107',
                color: '#000',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(drLayer);

            const newPosition = formatCoordinatePair(newLat, newLon);
            drMarker.bindPopup(`<b>DR Position</b><br>${newPosition}<br><small>${time.toFixed(1)}h, COG ${cog.toFixed(1)}° @ SOG ${sog.toFixed(2)} kts</small>`);

            // Display result
            const courseDisplay = '<div style="font-size:10px; margin:4px 0; padding:4px; background:#e3f2fd; border-radius:2px;">' +
                courseSteps.join('<br>') + '</div>';

            outputElement.innerHTML = `
                <div style="color:#155724;"><b>DR Position:</b></div>
                <div><b>New Pos:</b> ${newPosition}</div>
                <div style="margin-top:6px; padding-top:6px; border-top:1px solid #ddd;">
                    ${courseDisplay}
                    <b>COG:</b> ${cog.toFixed(1)}° &nbsp; <b>SOG:</b> ${sog.toFixed(2)} kts<br>
                    <b>Ground Dist:</b> ${distance.toFixed(2)} NM<br>
                    <b>Time:</b> ${time.toFixed(1)}h
                </div>
            `;

            // Fit bounds to show both points
            map.fitBounds(L.latLngBounds([startPos, drPosition]), { padding: [50, 50] });

        } catch (error) {
            outputElement.innerHTML = '<span style="color:#f44336;">⚠ Error: ' + error.message + '</span>';
            console.error('DR calculation error:', error);
        }
    }

    /**
     * Clear DR calculation
     */
    function clearDR() {
        if (drLayer) {
            drLayer.clearLayers();
        }
        document.getElementById('drOut').innerHTML = 'Enter values and calculate';
        document.getElementById('drStartLat').value = '';
        document.getElementById('drStartLon').value = '';
        console.log('DR cleared');
    }
    
    /**
     * Normalize angle to 0-360 range
     */
    function normalize(angle) {
        angle = angle % 360;
        if (angle < 0) {
            angle += 360;
        }
        return angle;
    }

})();