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
    let plotterModeActive = false;
    let previewCircle = null;

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
                container.style.border = '2px solid rgba(0,0,0,0.2)';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                container.style.cursor = 'pointer';

                container.innerHTML = `
                    <div id="coursePlotterToggle" style="padding: 8px 10px; background: white; border-radius: 4px; font-weight: bold; font-size: 12px;">
                        📐 Course Plotter
                    </div>
                    <div id="coursePlotterPanel" style="display: none; padding: 10px; padding-top: 0; min-width: 200px;">
                        <button id="togglePlotterMode"
                            style="width:100%; padding:8px; cursor:pointer; background:#6c757d; color:white; border:none; border-radius:3px; font-weight:bold; margin-bottom:5px;">
                        📐 Plotter Mode: OFF
                    </button>
                    <button id="clearCoursesBtn"
                            style="width:100%; padding:6px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:3px; font-weight:bold;">
                        Clear All Courses
                    </button>
                    <div id="courseOutput"
                         style="margin-top:10px; font-size:12px; font-family:monospace; line-height:1.6; min-height:60px; color:#333;">
                        Enable Plotter Mode to begin
                        </div>
                    </div>
                `;

                L.DomEvent.disableClickPropagation(container);

                // Initialize buttons after DOM is ready
                setTimeout(() => {
                    const panelToggle = document.getElementById('coursePlotterToggle');
                    const panel = document.getElementById('coursePlotterPanel');
                    const toggleBtn = document.getElementById('togglePlotterMode');
                    const clearBtn = document.getElementById('clearCoursesBtn');
                    outputElement = document.getElementById('courseOutput');
                    
                    // Toggle panel visibility
                    if (panelToggle && panel) {
                        panelToggle.onclick = function(e) {
                            e.stopPropagation();
                            const isVisible = panel.style.display !== 'none';
                            panel.style.display = isVisible ? 'none' : 'block';
                            panelToggle.style.background = isVisible ? 'white' : '#e8f5e9';
                        };
                    }
                    
                    if (toggleBtn && outputElement) {
                        toggleBtn.onclick = togglePlotterMode;
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
     * Toggle plotter mode on/off
     */
    function togglePlotterMode() {
        plotterModeActive = !plotterModeActive;
        const btn = document.getElementById('togglePlotterMode');
        
        if (plotterModeActive) {
            // Mode is now ON
            btn.style.background = '#28a745';
            btn.textContent = '✓ Plotter Mode: ON';
            map.getContainer().style.cursor = 'crosshair';
            startPoint = null;
            if (tempLine) {
                courseLayer.removeLayer(tempLine);
                tempLine = null;
            }
            enableCursorPreview();
            updateOutput('Click on the map to select<br><strong>first point</strong>');
        } else {
            // Mode is now OFF
            btn.style.background = '#6c757d';
            btn.textContent = '📐 Plotter Mode: OFF';
            map.getContainer().style.cursor = '';
            startPoint = null;
            if (tempLine) {
                courseLayer.removeLayer(tempLine);
                tempLine = null;
            }
            disableCursorPreview();
            updateOutput('Enable Plotter Mode to begin');
        }
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
        if (plotterModeActive) {
            updateOutput('All courses cleared.<br>Click to select <strong>first point</strong>');
        } else {
            updateOutput('All courses cleared.<br>Enable Plotter Mode to begin');
        }
    }

    /**
     * Handle map click events for course plotting
     */
    function handleMapClick(e) {
        if (!outputElement || !plotterModeActive) return;

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
     * Cursor preview circle: subtle marker that follows the mouse while
     * plotter mode is active, previewing where a click would place a point.
     */
    function enableCursorPreview() {
        if (previewCircle || !map) return;
        previewCircle = L.circleMarker(map.getCenter(), {
            radius: 10,
            color: '#2196F3',
            weight: 1.5,
            opacity: 0.6,
            fillColor: '#2196F3',
            fillOpacity: 0.18,
            interactive: false,
            bubblingMouseEvents: false
        });
        map.on('mousemove', updatePreviewCircle);
        map.on('mouseout', hidePreviewCircle);
        map.on('mouseover', showPreviewCircle);
    }

    function disableCursorPreview() {
        if (!map) return;
        map.off('mousemove', updatePreviewCircle);
        map.off('mouseout', hidePreviewCircle);
        map.off('mouseover', showPreviewCircle);
        if (previewCircle) {
            map.removeLayer(previewCircle);
            previewCircle = null;
        }
    }

    function updatePreviewCircle(e) {
        if (!previewCircle) return;
        previewCircle.setLatLng(e.latlng);
        if (!map.hasLayer(previewCircle)) {
            previewCircle.addTo(map);
        }
    }

    function hidePreviewCircle() {
        if (previewCircle && map.hasLayer(previewCircle)) {
            map.removeLayer(previewCircle);
        }
    }

    function showPreviewCircle(e) {
        if (previewCircle && !map.hasLayer(previewCircle)) {
            previewCircle.setLatLng(e.latlng);
            previewCircle.addTo(map);
        }
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