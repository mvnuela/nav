/**
 * Main Map Initialization and Orchestration
 * Coordinates all nautical map features
 */

(function() {
    'use strict';

    // Wait for DOM and Leaflet to be ready
    document.addEventListener('DOMContentLoaded', function() {
        initializeNauticalMap();
    });

    /**
     * Initialize the complete nautical map with all features
     */
    function initializeNauticalMap() {
        // Create map with initial position from Django template
        const map = L.map('map').setView(
            [window.initialLat, window.initialLon], 
            7
        );

        // Add OpenStreetMap tile layer (base layer)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Add OpenSeaMap overlay (nautical charts with buoys, lighthouses, etc.)
        L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: 'Map data: © <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
        }).addTo(map);

        // Initialize all map features
        initializeGraticule(map);
        initializeControls(map);
        initializeCoordinateInput(map);
        
        // Initialize additional tools (from separate modules)
        if (typeof initCoursePlotter === 'function') {
            initCoursePlotter(map);
        }
        if (typeof initDeadReckoning === 'function') {
            initDeadReckoning(map);
        }
        if (typeof initMaritimeObjects === 'function') {
            initMaritimeObjects(map);
        }
        
        console.log('✓ Nautical map initialized successfully');
    }

    /**
     * Initialize custom graticule layer with nautical formatting
     */
    function initializeGraticule(map) {
        const graticuleLayer = L.layerGroup().addTo(map);

        function drawGraticule() {
            graticuleLayer.clearLayers();

            const bounds = map.getBounds();
            const zoom = map.getZoom();

            // Determine interval based on zoom level (matching original)
            let interval;
            if (zoom <= 3) interval = 30;
            else if (zoom <= 5) interval = 10;
            else if (zoom <= 7) interval = 5;
            else if (zoom <= 9) interval = 1;
            else interval = 0.5;

            // Calculate bounds
            const latStart = Math.floor(bounds.getSouth() / interval) * interval;
            const latEnd = Math.ceil(bounds.getNorth() / interval) * interval;
            const lngStart = Math.floor(bounds.getWest() / interval) * interval;
            const lngEnd = Math.ceil(bounds.getEast() / interval) * interval;

            // Draw latitude lines
            for (let lat = latStart; lat <= latEnd; lat += interval) {
                // Draw line
                const line = L.polyline([
                    [lat, bounds.getWest()],
                    [lat, bounds.getEast()]
                ], {
                    color: '#0078A8',
                    weight: 1,
                    opacity: 0.4,
                    dashArray: '5, 5'
                });
                line.addTo(graticuleLayer);

                // Add label on the left edge
                const labelLat = lat;
                const labelLng = bounds.getWest() + (bounds.getEast() - bounds.getWest()) * 0.02;

                const label = L.marker([labelLat, labelLng], {
                    icon: L.divIcon({
                        className: 'graticule-label',
                        html: '<div style="background: rgba(255,255,255,0.8); padding: 2px 5px; border-radius: 3px; font-size: 11px; font-weight: bold; white-space: nowrap;">' +
                              decimalToNautical(lat, true) + '</div>',
                        iconSize: [120, 20],
                        iconAnchor: [0, 10]
                    })
                });
                label.addTo(graticuleLayer);
            }

            // Draw longitude lines
            for (let lng = lngStart; lng <= lngEnd; lng += interval) {
                // Draw line
                const line = L.polyline([
                    [bounds.getSouth(), lng],
                    [bounds.getNorth(), lng]
                ], {
                    color: '#0078A8',
                    weight: 1,
                    opacity: 0.4,
                    dashArray: '5, 5'
                });
                line.addTo(graticuleLayer);

                // Add label on the top edge
                const labelLat = bounds.getNorth() - (bounds.getNorth() - bounds.getSouth()) * 0.02;
                const labelLng = lng;

                const label = L.marker([labelLat, labelLng], {
                    icon: L.divIcon({
                        className: 'graticule-label',
                        html: '<div style="background: rgba(255,255,255,0.8); padding: 2px 5px; border-radius: 3px; font-size: 11px; font-weight: bold; white-space: nowrap;">' +
                              decimalToNautical(lng, false) + '</div>',
                        iconSize: [120, 20],
                        iconAnchor: [60, 20]
                    })
                });
                label.addTo(graticuleLayer);
            }
        }

        map.on('moveend', drawGraticule);
        map.on('zoomend', drawGraticule);
        drawGraticule(); // Initial draw
    }

    /**
     * Initialize custom map controls
     */
    function initializeControls(map) {
        // Add coordinate display control (shows position under cursor)
        L.control.coordinateDisplay().addTo(map);

        // Add zoom level display
        L.control.zoomDisplay().addTo(map);

        // Add nautical scale
        L.control.nauticalScale().addTo(map);

        // Add legend
        L.control.legend().addTo(map);
    }

    /**
     * Initialize "Go to Coordinates" input control
     */
    function initializeCoordinateInput(map) {
        L.Control.CoordinateInput = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: function() {
                const container = L.DomUtil.create('div', 'leaflet-control-coordinate-input');
                container.style.background = 'white';
                container.style.padding = '10px';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                container.style.marginTop = '10px';

                container.innerHTML = `
                    <div style="margin-bottom: 8px; font-weight: bold; font-size: 12px;">Go to Position:</div>
                    <input type="text" id="latInput" placeholder="Latitude (e.g. 54.5 or 54°30'N)"
                           style="width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                    <input type="text" id="lonInput" placeholder="Longitude (e.g. 18.5 or 018°30'E)"
                           style="width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                    <select id="zoomLevel" style="width: 100%; padding: 5px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 3px; font-size: 11px;">
                        <option value="7">Zoom: 7 (Regional)</option>
                        <option value="8">Zoom: 8 (Area)</option>
                        <option value="9">Zoom: 9 (Local)</option>
                        <option value="10" selected>Zoom: 10 (Detailed)</option>
                        <option value="11">Zoom: 11 (Close)</option>
                        <option value="12">Zoom: 12 (Very Close)</option>
                    </select>
                    <button id="goButton" style="width: 100%; padding: 6px; background: #0078A8; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        Navigate
                    </button>
                    <div id="inputError" style="color: red; font-size: 10px; margin-top: 5px; display: none;"></div>
                `;

                L.DomEvent.disableClickPropagation(container);

                return container;
            },

            onRemove: function() {}
        });

        const coordInput = new L.Control.CoordinateInput();
        coordInput.addTo(map);

        // Add event listener for the navigate button
        setTimeout(() => {
            document.getElementById('goButton').addEventListener('click', function() {
                const latInput = document.getElementById('latInput').value.trim();
                const lonInput = document.getElementById('lonInput').value.trim();
                const zoom = parseInt(document.getElementById('zoomLevel').value);
                const errorDiv = document.getElementById('inputError');

                try {
                    let lat, lon;

                    // Try to parse latitude - accept both decimal and nautical
                    if (latInput.includes('°') || latInput.includes('\'')) {
                        // Nautical format
                        lat = nauticalToDecimal(latInput);
                    } else {
                        // Decimal format
                        lat = parseFloat(latInput);
                    }

                    // Try to parse longitude - accept both decimal and nautical
                    if (lonInput.includes('°') || lonInput.includes('\'')) {
                        // Nautical format
                        lon = nauticalToDecimal(lonInput);
                    } else {
                        // Decimal format
                        lon = parseFloat(lonInput);
                    }

                    // Validate coordinates
                    if (isNaN(lat) || isNaN(lon)) {
                        throw new Error('Invalid coordinate format');
                    }

                    if (lat < -90 || lat > 90) {
                        throw new Error('Latitude must be between -90 and 90');
                    }

                    if (lon < -180 || lon > 180) {
                        throw new Error('Longitude must be between -180 and 180');
                    }

                    // Navigate to position
                    map.setView([lat, lon], zoom);

                    // Show success message
                    errorDiv.style.display = 'block';
                    errorDiv.style.color = 'green';
                    errorDiv.textContent = `Navigated to ${formatCoordinatePair(lat, lon)}`;

                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 3000);

                    console.log(`Navigated to: ${formatCoordinatePair(lat, lon)} at zoom ${zoom}`);

                } catch (error) {
                    errorDiv.style.display = 'block';
                    errorDiv.style.color = 'red';
                    errorDiv.textContent = 'Error: ' + error.message;
                    console.error('Navigation error:', error);
                }
            });

            // Allow Enter key to trigger navigation
            ['latInput', 'lonInput'].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            document.getElementById('goButton').click();
                        }
                    });
                }
            });
        }, 100);
    }

})();