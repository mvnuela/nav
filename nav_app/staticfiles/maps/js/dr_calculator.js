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
                            <td style="padding:4px 0;">Magnetic Declination (°):</td>
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
                            <td style="padding:4px 0;">Leeway/Drift (°):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drLeeway"
                                       type="number"
                                       step="0.1"
                                       placeholder="0.0 (+stbd, -port)"
                                       value="0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                                <small style="color:#666; font-size:10px;">+Starboard / -Port</small>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Speed (knots):</td>
                        </tr>
                        <tr>
                            <td>
                                <input id="drSpeed"
                                       type="number"
                                       min="0"
                                       step="0.1"
                                       placeholder="5.0"
                                       style="width:100%; padding:4px; border:1px solid #ccc; border-radius:3px;" />
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:4px 0;">Time (hours):</td>
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
                    ['drStartLat', 'drStartLon', 'drCourse', 'drDeclination', 'drDeviation', 'drLeeway', 'drSpeed', 'drTime'].forEach(id => {
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
            
            // Calculate true course from compass or use true course directly
            let trueCourse, magneticCourse, compassCourse;
            let courseSteps = [];
            
            if (courseType === 'compass') {
                // Compass → Magnetic → True
                compassCourse = courseInput;
                magneticCourse = normalize(compassCourse + deviation);
                trueCourse = normalize(magneticCourse + declination);
                
                courseSteps.push(`Compass: ${compassCourse.toFixed(1)}°`);
                if (deviation !== 0) {
                    courseSteps.push(`+ Deviation ${deviation.toFixed(1)}° = Magnetic ${magneticCourse.toFixed(1)}°`);
                }
                if (declination !== 0) {
                    courseSteps.push(`+ Declination ${declination.toFixed(1)}° = True ${trueCourse.toFixed(1)}°`);
                }
            } else {
                // Already true course
                trueCourse = courseInput;
                courseSteps.push(`True Course: ${trueCourse.toFixed(1)}°`);
            }
            
            // Calculate COG (Course Over Ground) by adding leeway
            const cog = normalize(trueCourse + leeway);
            if (leeway !== 0) {
                courseSteps.push(`+ Leeway ${leeway.toFixed(1)}° = COG ${cog.toFixed(1)}°`);
            }
            
            // Use COG for actual movement calculation
            const course = cog;

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

            // Calculate distance traveled
            const distance = speed * time; // nautical miles

            // Convert course to radians
            const courseRad = course * Math.PI / 180;

            // Calculate change in latitude and longitude
            // dLat in degrees = (distance in NM) / 60
            const dLat = distance * Math.cos(courseRad) / 60;
            
            // dLon in degrees = (distance in NM) / (60 * cos(latitude))
            const dLon = distance * Math.sin(courseRad) / (60 * Math.cos(lat * Math.PI / 180));

            // Calculate new position
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

            // Course line
            const courseLine = L.polyline([startPos, drPosition], {
                color: '#28a745',
                weight: 3,
                opacity: 0.8,
                dashArray: '10, 10'
            }).addTo(drLayer);

            const bearingFormatted = formatBearing(course);
            const courseInfo =courseSteps.length > 1 ? courseSteps.join('<br>') : `COG: ${course.toFixed(1)}°`;
            courseLine.bindPopup(`<b>DR Track</b><br>${courseInfo}<br>Speed: ${speed} kts<br>Time: ${time.toFixed(1)}h<br>Distance: ${distance.toFixed(2)} NM`);

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
            drMarker.bindPopup(`<b>DR Position</b><br>${newPosition}<br><small>${time.toFixed(1)}h at ${speed} kts</small>`);

            // Display result
            const courseDisplay = courseSteps.length > 1 ?
                '<div style="font-size:10px; margin:4px 0; padding:4px; background:#e3f2fd; border-radius:2px;">' +
                courseSteps.join('<br>') + '</div>' :
                `<b>COG:</b> ${bearingFormatted}<br>`;
            
            outputElement.innerHTML = `
                <div style="color:#155724;"><b>DR Position:</b></div>
                <div><b>New Pos:</b> ${newPosition}</div>
                <div style="margin-top:6px; padding-top:6px; border-top:1px solid #ddd;">
                    ${courseDisplay}
                    <b>Distance:</b> ${distance.toFixed(2)} NM<br>
                    <b>Time:</b> ${time.toFixed(1)}h @ ${speed} kts
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