/**
 * GPX Route Canvas Integration
 * Canvas-based GPX route rendering for enhanced graticule system
 * 
 * Features:
 * - Renders routes/tracks as canvas polylines
 * - Displays waypoints as canvas markers
 * - Manages multiple routes with visibility toggling
 * - Works with CoordinateMapper for proper projection
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
     * GPX Route class representing a single route/track for canvas rendering
     */
    class GPXRouteCanvas {
        constructor(id, name, data, type) {
            this.id = id;
            this.name = name;
            this.data = data;
            this.type = type; // 'route', 'track', or 'waypoint'
            this.color = ROUTE_COLORS[colorIndex % ROUTE_COLORS.length];
            colorIndex++;
            this.visible = true;
        }

        /**
         * Draw route on canvas
         */
        draw(ctx, mapper) {
            if (!this.visible) return;

            ctx.save();

            if (this.type === 'route') {
                this._drawRoute(ctx, mapper);
            } else if (this.type === 'track') {
                this._drawTrack(ctx, mapper);
            } else if (this.type === 'waypoint') {
                this._drawWaypoint(ctx, mapper);
            }

            ctx.restore();
        }

        /**
         * Draw route polyline and markers
         * @private
         */
        _drawRoute(ctx, mapper) {
            const points = this.data.points;
            if (points.length === 0) return;

            // Convert geographic to screen coordinates
            const screenPoints = points.map(p => 
                mapper.geographicToScreen(p.lat, p.lon)
            );

            // Draw polyline
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.8;
            
            ctx.beginPath();
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
            for (let i = 1; i < screenPoints.length; i++) {
                ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
            }
            ctx.stroke();

            // Draw start marker (green circle)
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#4CAF50';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenPoints[0].x, screenPoints[0].y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw end marker (red circle)
            if (screenPoints.length > 1) {
                const endIdx = screenPoints.length - 1;
                ctx.fillStyle = '#F44336';
                ctx.beginPath();
                ctx.arc(screenPoints[endIdx].x, screenPoints[endIdx].y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            // Draw intermediate waypoint markers
            for (let i = 1; i < screenPoints.length - 1; i++) {
                if (points[i].name) {
                    ctx.fillStyle = this.color;
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(screenPoints[i].x, screenPoints[i].y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }

        /**
         * Draw track polyline and markers
         * @private
         */
        _drawTrack(ctx, mapper) {
            for (const segment of this.data.segments) {
                const points = segment.points;
                if (points.length === 0) continue;

                // Convert geographic to screen coordinates
                const screenPoints = points.map(p => 
                    mapper.geographicToScreen(p.lat, p.lon)
                );

                // Draw polyline
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = 0.7;
                
                ctx.beginPath();
                ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
                for (let i = 1; i < screenPoints.length; i++) {
                    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
                }
                ctx.stroke();
            }

            // Draw start and end markers for first/last segment
            if (this.data.segments.length > 0) {
                const firstSeg = this.data.segments[0];
                const lastSeg = this.data.segments[this.data.segments.length - 1];

                if (firstSeg.points.length > 0) {
                    const startScreen = mapper.geographicToScreen(
                        firstSeg.points[0].lat,
                        firstSeg.points[0].lon
                    );

                    ctx.globalAlpha = 1.0;
                    ctx.fillStyle = '#4CAF50';
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(startScreen.x, startScreen.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }

                if (lastSeg.points.length > 0) {
                    const endIdx = lastSeg.points.length - 1;
                    const endScreen = mapper.geographicToScreen(
                        lastSeg.points[endIdx].lat,
                        lastSeg.points[endIdx].lon
                    );

                    ctx.fillStyle = '#F44336';
                    ctx.beginPath();
                    ctx.arc(endScreen.x, endScreen.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }

        /**
         * Draw waypoint marker
         * @private
         */
        _drawWaypoint(ctx, mapper) {
            const screen = mapper.geographicToScreen(this.data.lat, this.data.lon);

            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#2196F3';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw label if name exists
            if (this.data.name) {
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                
                const label = this.data.name;
                const metrics = ctx.measureText(label);
                const padding = 3;
                const labelWidth = metrics.width + padding * 2;
                const labelHeight = 14;

                // Background
                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.fillRect(
                    screen.x - labelWidth/2,
                    screen.y - labelHeight - 8,
                    labelWidth,
                    labelHeight
                );

                // Border
                ctx.strokeStyle = '#2196F3';
                ctx.lineWidth = 1;
                ctx.strokeRect(
                    screen.x - labelWidth/2,
                    screen.y - labelHeight - 8,
                    labelWidth,
                    labelHeight
                );

                // Text
                ctx.fillStyle = '#333';
                ctx.fillText(label, screen.x, screen.y - 10);
            }
        }

        /**
         * Get bounds for this route
         */
        getBounds() {
            if (this.type === 'waypoint') {
                return {
                    minLat: this.data.lat,
                    maxLat: this.data.lat,
                    minLon: this.data.lon,
                    maxLon: this.data.lon
                };
            }
            return this.data.bounds;
        }
    }

    /**
     * GPX Routes Manager for Canvas
     */
    class GPXRoutesManagerCanvas {
        constructor() {
            this.parser = new GPXParser();
            this.routes = [];
            this.nextId = 1;
        }

        /**
         * Load and parse GPX file
         */
        loadGPXFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        const gpxData = this.parser.parse(e.target.result);
                        this.addGPXData(gpxData, file.name);
                        resolve(gpxData);
                    } catch (error) {
                        reject(error);
                    }
                };

                reader.onerror = () => {
                    reject(new Error('Error reading file'));
                };

                reader.readAsText(file);
            });
        }

        /**
         * Add parsed GPX data
         */
        addGPXData(gpxData, filename) {
            const addedRoutes = [];

            // Add routes
            for (const routeData of gpxData.routes) {
                const route = new GPXRouteCanvas(
                    this.nextId++,
                    routeData.name || `Route from ${filename}`,
                    routeData,
                    'route'
                );
                this.routes.push(route);
                addedRoutes.push(route);
            }

            // Add tracks
            for (const trackData of gpxData.tracks) {
                const track = new GPXRouteCanvas(
                    this.nextId++,
                    trackData.name || `Track from ${filename}`,
                    trackData,
                    'track'
                );
                this.routes.push(track);
                addedRoutes.push(track);
            }

            // Add waypoints
            for (const waypointData of gpxData.waypoints) {
                const waypoint = new GPXRouteCanvas(
                    this.nextId++,
                    waypointData.name || 'Waypoint',
                    waypointData,
                    'waypoint'
                );
                this.routes.push(waypoint);
                addedRoutes.push(waypoint);
            }

            return addedRoutes;
        }

        /**
         * Draw all visible routes
         */
        drawAll(ctx, mapper) {
            for (const route of this.routes) {
                route.draw(ctx, mapper);
            }
        }

        /**
         * Toggle route visibility
         */
        toggleRoute(routeId) {
            const route = this.routes.find(r => r.id === routeId);
            if (route) {
                route.visible = !route.visible;
                return route.visible;
            }
            return false;
        }

        /**
         * Remove a specific route
         */
        removeRoute(routeId) {
            const index = this.routes.findIndex(r => r.id === routeId);
            if (index !== -1) {
                this.routes.splice(index, 1);
                return true;
            }
            return false;
        }

        /**
         * Clear all routes
         */
        clearAll() {
            this.routes = [];
            colorIndex = 0;
        }

        /**
         * Get all routes bounds
         */
        getAllBounds() {
            if (this.routes.length === 0) return null;

            let minLat = Infinity;
            let maxLat = -Infinity;
            let minLon = Infinity;
            let maxLon = -Infinity;

            for (const route of this.routes) {
                if (!route.visible) continue;
                
                const bounds = route.getBounds();
                if (bounds) {
                    minLat = Math.min(minLat, bounds.minLat || bounds.south);
                    maxLat = Math.max(maxLat, bounds.maxLat || bounds.north);
                    minLon = Math.min(minLon, bounds.minLon || bounds.west);
                    maxLon = Math.max(maxLon, bounds.maxLon || bounds.east);
                }
            }

            if (minLat === Infinity) return null;

            return { minLat, maxLat, minLon, maxLon };
        }

        /**
         * Get route by ID
         */
        getRoute(routeId) {
            return this.routes.find(r => r.id === routeId);
        }
    }

    // Export to global scope
    window.GPXRoutesManagerCanvas = GPXRoutesManagerCanvas;
    window.GPXRouteCanvas = GPXRouteCanvas;

})();