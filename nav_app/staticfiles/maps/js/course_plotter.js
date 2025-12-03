/**
 * Course Plotter Module
 * Allows users to plot courses between two points and calculate distance/bearing
 */

(function() {
    'use strict';

    // State management
    let map = null;
    let startPoint = null;
    let tempLine = null;
    let outputElement = null;
    let courseLayer = null;

    /**
     * Initialize course plotter on the map
     * @param {L.Map} leafletMap - The Leaflet map instance
     */
    window.initCoursePlotter = function(leafletMap) {
        map = leafletMap;
        courseLayer = L.layerGroup().addTo(map);
        
        // Create custom control
        L.Control.CoursePlotter = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: function() {
                const container = L.DomUtil.create('div', 'course-plot-control');
                container.style.background = 'white';
                container.style.padding = '10px';
                container.style.border = '2px solid rgba(0,0,0,0.2)';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                container.style.minWidth = '200px';

                container.innerHTML = `
                    <div style="margin-bottom: 8px;">
                        <strong>📐 Course Plotter</strong>
                    </div>
                    <button id="coursePlotBtn"
                            style="width:100%; padding:6px; cursor:pointer; background:#2196F3; color:white; border:none; border-radius:3px; font-weight:bold; margin-bottom:5px;">
                        Start Plotting
                    </button>
                    <button id="clearCoursesBtn"
                            style="width:100%; padding:6px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:3px; font-weight:bold;">
                        Clear All Courses
                    </button>
                    <div id="courseOutput"
                         style="margin-top:10px; font-size:12px; font-family:monospace; line-height:1.6; min-height:60px; color:#333;">
                        Click "Start Plotting" to begin
                    </div>
                `;

                L.DomEvent.disableClickPropagation(container);

                // Initialize buttons after DOM is ready
                setTimeout(() => {
                    const plotBtn = document.getElementById('coursePlotBtn');
                    const clearBtn = document.getElementById('clearCoursesBtn');
                    outputElement = document.getElementById('courseOutput');
                    
                    if (plotBtn && outputElement) {
                        plotBtn.onclick = startPlotting;
                    }
                    
                    if (clearBtn) {
                        clearBtn.onclick = clearAllCourses;
                    }
                }, 100);

                return container;
            }
        });

        // Add control to map
        new L.Control.CoursePlotter().addTo(map);

        // Listen for map clicks
        map.on('click', handleMapClick);
    };

    /**
     * Start the plotting process
     */
    function startPlotting() {
        startPoint = null;
        if (tempLine) {
            courseLayer.removeLayer(tempLine);
            tempLine = null;
        }
        updateOutput('Click on the map to select<br><strong>first point</strong>');
    }

    /**
     * Clear all plotted courses
     */
    function clearAllCourses() {
        if (courseLayer) {
            courseLayer.clearLayers();
        }
        startPoint = null;
        if (tempLine) {
            tempLine = null;
        }
        updateOutput('All courses cleared.<br>Click "Start Plotting" to begin');
    }

    /**
     * Handle map click events for course plotting
     */
    function handleMapClick(e) {
        if (!outputElement) return;

        // First point selection
        if (!startPoint) {
            startPoint = e.latlng;
            const coords = formatCoordinatePair(startPoint.lat, startPoint.lng);
            updateOutput(`<strong>Start:</strong> ${coords}<br>Now click <strong>end point</strong>`);
            
            // Add temporary marker
            L.circleMarker(startPoint, {
                radius: 5,
                color: '#2196F3',
                fillColor: '#2196F3',
                fillOpacity: 0.8
            }).addTo(courseLayer);
            
            return;
        }

        // Second point selection
        const endPoint = e.latlng;

        // Calculate course and distance
        const distance = calculateDistance(
            startPoint.lat, startPoint.lng, 
            endPoint.lat, endPoint.lng
        );
        
        const bearing = calculateBearing(
            startPoint.lat, startPoint.lng, 
            endPoint.lat, endPoint.lng
        );

        // Remove temp line if exists
        if (tempLine) {
            courseLayer.removeLayer(tempLine);
            tempLine = null;
        }
        
        // Draw permanent course line
        const courseLine = L.polyline([startPoint, endPoint], {
            color: '#FF5722',
            weight: 3,
            opacity: 0.8,
            dashArray: '10, 5'
        }).addTo(courseLayer);

        // Add end marker
        L.circleMarker(endPoint, {
            radius: 5,
            color: '#FF5722',
            fillColor: '#FF5722',
            fillOpacity: 0.8
        }).addTo(courseLayer);

        // Display results
        const startCoords = formatCoordinatePair(startPoint.lat, startPoint.lng);
        const endCoords = formatCoordinatePair(endPoint.lat, endPoint.lng);
        
        updateOutput(`
            <strong>Start:</strong> ${startCoords}<br>
            <strong>End:</strong> ${endCoords}<br>
            <div style="margin-top:8px; padding-top:8px; border-top:1px solid #ddd;">
                <strong>Course:</strong> ${formatBearing(bearing)}<br>
                <strong>Distance:</strong> ${distance.toFixed(2)} NM
            </div>
        `);

        // Reset for next plot
        startPoint = null;
    }

    /**
     * Update the output display
     */
    function updateOutput(html) {
        if (outputElement) {
            outputElement.innerHTML = html;
        }
    }

})();