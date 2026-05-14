/**
 * GPX Route Leaflet Integration
 * Integrates GPX parser with Leaflet maps and provides UI controls
 * 
 * Features:
 * - Renders routes/tracks as polylines with custom styling
 * - Displays waypoints as markers
 * - Interactive, hideable UI control panel
 * - Manages multiple routes with visibility toggling
 * - Fit to view functionality
 */

(function() {
    'use strict';

    // Color palette for routes
    const ROUTE_COLORS = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
        '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];

    let colorIndex = 0;

    /**
     * GPX Route class representing a single route/track
     */
    class GPXRoute {
        constructor(id, name, data, type) {
            this.id = id;
            this.name = name;
            this.data = data;
            this.type = type; // 'route', 'track', or 'waypoint'
            this.color = ROUTE_COLORS[colorIndex % ROUTE_COLORS.length];
            colorIndex++;
            this.visible = true;
            this.layer = null;
            this.markers = [];
        }

        /**
         * Create Leaflet layer for this route
         */
        createLayer(map) {
            if (this.layer) return this.layer;

            this.layer = L.layerGroup();

            if (this.type === 'route') {
                this._createRouteLayer(map);
            } else if (this.type === 'track') {
                this._createTrackLayer(map);
            } else if (this.type === 'waypoint') {
                this._createWaypointLayer(map);
            }

            return this.layer;
        }

        /**
         * Create layer for route data
         * @private
         */
        _createRouteLayer(map) {
            const points = this.data.points.map(p => [p.lat, p.lon]);

            // Create polyline
            const polyline = L.polyline(points, {
                color: this.color,
                weight: 4,
                opacity: 0.8
            });

            polyline.bindPopup(this._createRoutePopup());
            polyline.addTo(this.layer);

            // Add start marker (green)
            if (points.length > 0) {
                const startMarker = L.circleMarker(points[0], {
                    radius: 8,
                    fillColor: '#4CAF50',
                    color: 'white',
                    weight: 2,
                    fillOpacity: 1
                });
                startMarker.bindPopup(`<b>Start:</b> ${this.data.points[0].name || 'Route Start'}`);
                startMarker.addTo(this.layer);
                this.markers.push(startMarker);

                // Add end marker (red)
                if (points.length > 1) {
                    const endIdx = points.length - 1;
                    const endMarker = L.circleMarker(points[endIdx], {
                        radius: 8,
                        fillColor: '#F44336',
                        color: 'white',
                        weight: 2,
                        fillOpacity: 1
                    });
                    endMarker.bindPopup(`<b>End:</b> ${this.data.points[endIdx].name || 'Route End'}`);
                    endMarker.addTo(this.layer);
                    this.markers.push(endMarker);
                }

                // Add waypoint markers
                for (let i = 1; i < points.length - 1; i++) {
                    const pt = this.data.points[i];
                    if (pt.name) {
                        const marker = L.circleMarker(points[i], {
                            radius: 6,
                            fillColor: this.color,
                            color: 'white',
                            weight: 2,
                            fillOpacity: 0.8
                        });
                        marker.bindPopup(`<b>${pt.name}</b>${pt.description ? '<br>' + pt.description : ''}`);
                        marker.addTo(this.layer);
                        this.markers.push(marker);
                    }
                }
            }
        }

        /**
         * Create layer for track data
         * @private
         */
        _createTrackLayer(map) {
            for (const segment of this.data.segments) {
                const points = segment.points.map(p => [p.lat, p.lon]);

                const polyline = L.polyline(points, {
                    color: this.color,
                    weight: 3,
                    opacity: 0.7
                });

                polyline.bindPopup(this._createTrackPopup());
                polyline.addTo(this.layer);
            }

            // Add start and end markers for first segment
            if (this.data.segments.length > 0 && this.data.segments[0].points.length > 0) {
                const firstSeg = this.data.segments[0];
                const lastSeg = this.data.segments[this.data.segments.length - 1];

                const startPt = [firstSeg.points[0].lat, firstSeg.points[0].lon];
                const startMarker = L.circleMarker(startPt, {
                    radius: 7,
                    fillColor: '#4CAF50',
                    color: 'white',
                    weight: 2,
                    fillOpacity: 1
                });
                startMarker.bindPopup('<b>Track Start</b>');
                startMarker.addTo(this.layer);
                this.markers.push(startMarker);

                const endIdx = lastSeg.points.length - 1;
                const endPt = [lastSeg.points[endIdx].lat, lastSeg.points[endIdx].lon];
                const endMarker = L.circleMarker(endPt, {
                    radius: 7,
                    fillColor: '#F44336',
                    color: 'white',
                    weight: 2,
                    fillOpacity: 1
                });
                endMarker.bindPopup('<b>Track End</b>');
                endMarker.addTo(this.layer);
                this.markers.push(endMarker);
            }
        }

        /**
         * Create layer for waypoint data
         * @private
         */
        _createWaypointLayer(map) {
            const pt = [this.data.lat, this.data.lon];
            const marker = L.marker(pt, {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            });

            marker.bindPopup(this._createWaypointPopup());
            marker.addTo(this.layer);
            this.markers.push(marker);
        }

        /**
         * Create popup content for route
         * @private
         */
        _createRoutePopup() {
            return `
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 8px 0; color: ${this.color};">${this.name}</h4>
                    ${this.data.description ? `<p style="margin: 4px 0;">${this.data.description}</p>` : ''}
                    <p style="margin: 4px 0;"><b>Distance:</b> ${this.data.distance.toFixed(2)} NM</p>
                    <p style="margin: 4px 0;"><b>Waypoints:</b> ${this.data.points.length}</p>
                </div>
            `;
        }

        /**
         * Create popup content for track
         * @private
         */
        _createTrackPopup() {
            const elevInfo = this.data.elevationData ?
                `<p style="margin: 4px 0;"><b>Elevation:</b> ${this.data.elevationData.min.toFixed(0)}m - ${this.data.elevationData.max.toFixed(0)}m (gain: ${this.data.elevationData.gain.toFixed(0)}m)</p>` : '';

            return `
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 8px 0; color: ${this.color};">${this.name}</h4>
                    ${this.data.description ? `<p style="margin: 4px 0;">${this.data.description}</p>` : ''}
                    <p style="margin: 4px 0;"><b>Distance:</b> ${this.data.totalDistance.toFixed(2)} NM</p>
                    <p style="margin: 4px 0;"><b>Segments:</b> ${this.data.segments.length}</p>
                    ${elevInfo}
                </div>
            `;
        }

        /**
         * Create popup content for waypoint
         * @private
         */
        _createWaypointPopup() {
            return `
                <div style="min-width: 150px;">
                    <h4 style="margin: 0 0 8px 0; color: #2196F3;">${this.name}</h4>
                    ${this.data.description ? `<p style="margin: 4px 0;">${this.data.description}</p>` : ''}
                    <p style="margin: 4px 0;"><b>Position:</b><br>${this.data.lat.toFixed(6)}°, ${this.data.lon.toFixed(6)}°</p>
                    ${this.data.elevation ? `<p style="margin: 4px 0;"><b>Elevation:</b> ${this.data.elevation.toFixed(1)}m</p>` : ''}
                </div>
            `;
        }

        /**
         * Show route on map
         */
        show(map) {
            if (!this.layer) {
                this.createLayer(map);
            }
            if (!map.hasLayer(this.layer)) {
                this.layer.addTo(map);
            }
            this.visible = true;
        }

        /**
         * Hide route from map
         */
        hide(map) {
            if (this.layer && map.hasLayer(this.layer)) {
                map.removeLayer(this.layer);
            }
            this.visible = false;
        }

        /**
         * Get bounds for this route
         */
        getBounds() {
            if (this.type === 'waypoint') {
                return L.latLngBounds([[this.data.lat, this.data.lon]]);
            }
            return this.data.bounds ? 
                L.latLngBounds(
                    [this.data.bounds.south, this.data.bounds.west],
                    [this.data.bounds.north, this.data.bounds.east]
                ) : null;
        }

        /**
         * Remove route completely
         */
        remove(map) {
            this.hide(map);
            if (this.layer) {
                this.layer.clearLayers();
                this.layer = null;
            }
            this.markers = [];
        }
    }

    /**
     * GPX Routes Manager
     */
    class GPXRoutesManager {
        constructor(map) {
            this.map = map;
            this.parser = new GPXParser();
            this.routes = [];
            this.nextId = 1;
            this.panelVisible = false;
            this.control = null;
            this.init();
        }

        /**
         * Initialize the GPX control
         */
        init() {
            this.createControl();
        }

        /**
         * Create Leaflet control for GPX management
         */
        createControl() {
            const GPXControl = L.Control.extend({
                options: {
                    position: 'topright'
                },

                onAdd: (map) => {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                    container.style.background = 'white';
                    container.style.cursor = 'pointer';

                    // Toggle button
                    const toggleBtn = L.DomUtil.create('button', '', container);
                    toggleBtn.innerHTML = '📍 GPX Routes';
                    toggleBtn.style.padding = '8px 12px';
                    toggleBtn.style.border = 'none';
                    toggleBtn.style.background = 'white';
                    toggleBtn.style.cursor = 'pointer';
                    toggleBtn.style.fontSize = '13px';
                    toggleBtn.style.fontWeight = 'bold';
                    toggleBtn.style.borderRadius = '4px';
                    toggleBtn.title = 'Show/Hide GPX Panel';

                    // Create panel container
                    const panel = L.DomUtil.create('div', '', container);
                    panel.style.display = 'none';
                    panel.style.marginTop = '5px';
                    panel.style.padding = '12px';
                    panel.style.background = 'white';
                    panel.style.borderRadius = '4px';
                    panel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                    panel.style.minWidth = '300px';
                    panel.style.maxWidth = '400px';
                    panel.style.maxHeight = '500px';
                    panel.style.overflowY = 'auto';

                    panel.innerHTML = `
                        <div style="margin-bottom: 12px;">
                            <h4 style="margin: 0 0 8px 0; color: #0078A8;">📍 GPX Routes</h4>
                            <input type="file" id="gpxFileInput" accept=".gpx" style="display: none;">
                            <button id="loadGPXBtn" style="width: 100%; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px;">
                                📁 Load GPX File
                            </button>
                        </div>
                        <div id="gpxRoutesList" style="margin-bottom: 12px;">
                            <p style="color: #999; font-size: 12px; text-align: center; margin: 20px 0;">No routes loaded</p>
                        </div>
                        <div id="gpxGlobalActions" style="display: none; border-top: 1px solid #ddd; padding-top: 10px;">
                            <button id="fitAllRoutesBtn" style="width: 100%; padding: 6px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-bottom: 4px;">
                                🗺️ Fit All to View
                            </button>
                            <button id="clearAllRoutesBtn" style="width: 100%; padding: 6px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                🗑️ Clear All Routes
                            </button>
                        </div>
                    `;

                    // Toggle panel visibility
                    L.DomEvent.on(toggleBtn, 'click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        this.panelVisible = !this.panelVisible;
                        panel.style.display = this.panelVisible ? 'block' : 'none';
                        toggleBtn.style.background = this.panelVisible ? '#e8f5e9' : 'white';
                    });

                    // Prevent map interactions on panel
                    L.DomEvent.disableClickPropagation(container);
                    L.DomEvent.disableScrollPropagation(container);

                    // Setup file input
                    const fileInput = panel.querySelector('#gpxFileInput');
                    const loadBtn = panel.querySelector('#loadGPXBtn');
                    
                    L.DomEvent.on(loadBtn, 'click', () => {
                        fileInput.click();
                    });

                    L.DomEvent.on(fileInput, 'change', (e) => {
                        if (e.target.files.length > 0) {
                            this.loadGPXFile(e.target.files[0]);
                        }
                    });

                    // Setup global action buttons
                    const fitAllBtn = panel.querySelector('#fitAllRoutesBtn');
                    const clearAllBtn = panel.querySelector('#clearAllRoutesBtn');

                    L.DomEvent.on(fitAllBtn, 'click', () => this.fitAllRoutes());
                    L.DomEvent.on(clearAllBtn, 'click', () => this.clearAllRoutes());

                    this.panel = panel;
                    return container;
                },

                onRemove: (map) => {}
            });

            this.control = new GPXControl();
            this.control.addTo(this.map);
        }

        /**
         * Load and parse GPX file
         */
        loadGPXFile(file) {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const gpxData = this.parser.parse(e.target.result);
                    this.addGPXData(gpxData, file.name);
                    console.log('GPX file loaded:', file.name);
                } catch (error) {
                    alert('Error loading GPX file: ' + error.message);
                    console.error('GPX parse error:', error);
                }
            };

            reader.onerror = () => {
                alert('Error reading file');
            };

            reader.readAsText(file);
        }

        /**
         * Add parsed GPX data to map
         */
        addGPXData(gpxData, filename) {
            // Add routes
            for (const routeData of gpxData.routes) {
                const route = new GPXRoute(
                    this.nextId++,
                    routeData.name || `Route from ${filename}`,
                    routeData,
                    'route'
                );
                this.routes.push(route);
                route.show(this.map);
            }

            // Add tracks
            for (const trackData of gpxData.tracks) {
                const track = new GPXRoute(
                    this.nextId++,
                    trackData.name || `Track from ${filename}`,
                    trackData,
                    'track'
                );
                this.routes.push(track);
                track.show(this.map);
            }

            // Add waypoints
            for (const waypointData of gpxData.waypoints) {
                const waypoint = new GPXRoute(
                    this.nextId++,
                    waypointData.name || 'Waypoint',
                    waypointData,
                    'waypoint'
                );
                this.routes.push(waypoint);
                waypoint.show(this.map);
            }

            this.updateRoutesList();
            this.fitAllRoutes();
        }

        /**
         * Update the routes list in UI
         */
        updateRoutesList() {
            const listContainer = this.panel.querySelector('#gpxRoutesList');
            const globalActions = this.panel.querySelector('#gpxGlobalActions');

            if (this.routes.length === 0) {
                listContainer.innerHTML = '<p style="color: #999; font-size: 12px; text-align: center; margin: 20px 0;">No routes loaded</p>';
                globalActions.style.display = 'none';
                return;
            }

            globalActions.style.display = 'block';

            let html = '';
            for (const route of this.routes) {
                const typeIcon = route.type === 'route' ? '🛣️' : route.type === 'track' ? '📍' : '📌';
                const distanceText = route.type === 'waypoint' ? '' : 
                    ` • ${(route.type === 'track' ? route.data.totalDistance : route.data.distance).toFixed(1)} NM`;

                html += `
                    <div style="margin-bottom: 8px; padding: 8px; background: ${route.visible ? '#f0f8ff' : '#f5f5f5'}; border: 1px solid ${route.visible ? route.color : '#ddd'}; border-radius: 4px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                            <input type="checkbox" id="route_${route.id}" ${route.visible ? 'checked' : ''} style="cursor: pointer;">
                            <span style="width: 12px; height: 12px; background: ${route.color}; border-radius: 2px; display: inline-block;"></span>
                            <label for="route_${route.id}" style="flex: 1; cursor: pointer; font-weight: 600; font-size: 12px; color: #333;">
                                ${typeIcon} ${route.name}
                            </label>
                            <button class="remove-route-btn" data-id="${route.id}" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 16px; padding: 0 4px;" title="Remove">×</button>
                        </div>
                        <div style="font-size: 11px; color: #666; margin-left: 32px;">
                            ${route.type}${distanceText}
                        </div>
                        <button class="fit-route-btn" data-id="${route.id}" style="margin-left: 32px; margin-top: 4px; padding: 4px 8px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                            Fit to View
                        </button>
                    </div>
                `;
            }

            listContainer.innerHTML = html;

            // Add event listeners
            for (const route of this.routes) {
                const checkbox = listContainer.querySelector(`#route_${route.id}`);
                if (checkbox) {
                    L.DomEvent.on(checkbox, 'change', () => {
                        if (checkbox.checked) {
                            route.show(this.map);
                        } else {
                            route.hide(this.map);
                        }
                        this.updateRoutesList();
                    });
                }

                const removeBtn = listContainer.querySelector(`.remove-route-btn[data-id="${route.id}"]`);
                if (removeBtn) {
                    L.DomEvent.on(removeBtn, 'click', () => this.removeRoute(route.id));
                }

                const fitBtn = listContainer.querySelector(`.fit-route-btn[data-id="${route.id}"]`);
                if (fitBtn) {
                    L.DomEvent.on(fitBtn, 'click', () => this.fitRoute(route.id));
                }
            }
        }

        /**
         * Remove a specific route
         */
        removeRoute(routeId) {
            const routeIndex = this.routes.findIndex(r => r.id === routeId);
            if (routeIndex !== -1) {
                const route = this.routes[routeIndex];
                route.remove(this.map);
                this.routes.splice(routeIndex, 1);
                this.updateRoutesList();
            }
        }

        /**
         * Fit map to show specific route
         */
        fitRoute(routeId) {
            const route = this.routes.find(r => r.id === routeId);
            if (route) {
                const bounds = route.getBounds();
                if (bounds) {
                    this.map.fitBounds(bounds, { padding: [50, 50] });
                }
            }
        }

        /**
         * Fit map to show all routes
         */
        fitAllRoutes() {
            if (this.routes.length === 0) return;

            const bounds = L.latLngBounds([]);
            for (const route of this.routes) {
                const routeBounds = route.getBounds();
                if (routeBounds) {
                    bounds.extend(routeBounds);
                }
            }

            if (bounds.isValid()) {
                this.map.fitBounds(bounds, { padding: [50, 50] });
            }
        }

        /**
         * Clear all routes
         */
        clearAllRoutes() {
            if (this.routes.length === 0) return;

            if (confirm('Remove all routes?')) {
                for (const route of this.routes) {
                    route.remove(this.map);
                }
                this.routes = [];
                colorIndex = 0;
                this.updateRoutesList();
            }
        }
    }

    /**
     * Initialize GPX routes functionality
     */
    window.initGPXRoutes = function(map) {
        const manager = new GPXRoutesManager(map);
        console.log('✓ GPX Routes initialized');
        return manager;
    };

})();