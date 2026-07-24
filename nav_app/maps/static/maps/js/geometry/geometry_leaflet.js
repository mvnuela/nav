/**
 * Geometry Tools for Leaflet-based Sea Map
 * Points, Connections (line segments), and Rays (half-lines)
 * Pattern: matches observed_position.js IIFE
 */

(function() {
    'use strict';

    let map = null;
    let store = null;
    let geometryLayer = null;

    // Interaction mode: 'none', 'place_point', 'connect', 'ray', 'delete'.
    // Derived from the interaction machine via a subscribe callback in
    // registerInteractionStates() below — no longer owned by this tool.
    // Kept as a plain variable so every existing reader keeps working
    // untouched.
    let mode = 'none';
    let pendingFirstPointId = null;

    // Maps from model IDs to Leaflet layers
    let pointMarkers = {};
    let connectionLines = {};
    let rayLines = {};

    // Cursor preview shown while "Place Point" mode is active
    let previewCircle = null;

    // Colors
    const COLORS = {
        point: '#E91E63',
        pointPending: '#FFC107',
        connection: '#2196F3',
        ray: '#FF9800'
    };

    window.initGeometry = function(leafletMap) {
        map = leafletMap;
        store = new GeometryStore();
        geometryLayer = L.layerGroup().addTo(map);
        createControlPanel();
        registerInteractionStates();
        map.on('moveend', updateAllRays);
        map.on('zoomend', updateAllRays);
        console.log('Geometry tools initialized');
    };

    /**
     * Map an interaction state id back to the legacy mode string that every
     * existing reader of `mode` already understands.
     */
    function modeStringForState(stateId) {
        switch (stateId) {
            case window.GeometryStates.PLACE_POINT: return 'place_point';
            case window.GeometryStates.CONNECT:      return 'connect';
            case window.GeometryStates.RAY:          return 'ray';
            case window.GeometryStates.DELETE:        return 'delete';
            default:                                  return 'none';
        }
    }

    /**
     * Un-highlight and drop the pending first point of a Connect/Ray flow,
     * if any. Shared by the CONNECT/RAY states' onExit and the geometry
     * tool's onDeactivate.
     */
    function clearPendingPoint() {
        if (pendingFirstPointId !== null) {
            highlightPoint(pendingFirstPointId, false);
            pendingFirstPointId = null;
        }
    }

    /**
     * Register this tool's four placement states with the interaction
     * machine, before the machine is started (see main_map.js). Only
     * PLACE_POINT reacts to TAP — Connect / Ray / Delete act on clicks on
     * existing points/lines via their own Leaflet feature handlers (which
     * already stopPropagation), so they need no TAP handler of their own.
     * They still need machine states so arming them is mutually exclusive
     * with every other placement tool, in particular observed position.
     */
    function registerInteractionStates() {
        if (!window.mapInteraction) return;

        const IDLE = window.InteractionStates.IDLE;

        window.mapInteraction.register(window.defineState({
            id: window.GeometryStates.PLACE_POINT,
            tool: 'geometry',
            cursor: 'crosshair',
            targets: [IDLE],
            on: {
                TAP: function(event) {
                    addPoint(event.lat, event.lng);
                    // One-shot: disarm after a single placement so the next
                    // map interaction can't accidentally place more points.
                    return IDLE;
                },
                ESCAPE: function() { return IDLE; }
            }
        }));

        window.mapInteraction.register(window.defineState({
            id: window.GeometryStates.CONNECT,
            tool: 'geometry',
            targets: [IDLE],
            on: {
                ESCAPE: function() { return IDLE; }
            },
            // Also covers switching straight to another geometry mode (e.g.
            // Connect -> Ray) without leaving the tool: registerTool's
            // onDeactivate only fires on a *tool* change, so a same-tool
            // mode switch needs its own cleanup here to match today's
            // setActiveMode behaviour (pending point always cleared).
            onExit: clearPendingPoint
        }));

        window.mapInteraction.register(window.defineState({
            id: window.GeometryStates.RAY,
            tool: 'geometry',
            targets: [IDLE],
            on: {
                ESCAPE: function() { return IDLE; }
            },
            onExit: clearPendingPoint
        }));

        window.mapInteraction.register(window.defineState({
            id: window.GeometryStates.DELETE,
            tool: 'geometry',
            targets: [IDLE],
            on: {
                ESCAPE: function() { return IDLE; }
            }
        }));

        // Cancel partial work (a pending first point of a Connect/Ray flow)
        // whenever the machine leaves geometry for a different tool.
        window.mapInteraction.registerTool('geometry', {
            onDeactivate: clearPendingPoint
        });

        // mode is derived, not owned: every existing reader keeps working
        // without further changes. Also drives the cursor preview ring,
        // which today only appears while PLACE_POINT is active.
        window.mapInteraction.subscribe(function(state) {
            mode = modeStringForState(state.id);
            updateModeButtons();
            updateStatus();
            if (mode === 'place_point') {
                enableCursorPreview();
            } else {
                disableCursorPreview();
            }
        });
    }

    // ——— Points ———

    function addPoint(lat, lng) {
        const pt = store.addPoint(lat, lng);
        const marker = L.circleMarker([lat, lng], {
            radius: 5,
            color: '#fff',
            weight: 2,
            fillColor: COLORS.point,
            fillOpacity: 0.9
        });
        marker.pointId = pt.id;

        marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            handlePointClick(pt.id);
        });

        marker.bindTooltip(`P${pt.id}`, {
            permanent: true,
            direction: 'top',
            offset: [0, -10],
            className: 'geometry-point-label'
        });

        marker.addTo(geometryLayer);
        pointMarkers[pt.id] = marker;
        updateElementList();
    }

    function handlePointClick(pointId) {
        if (mode === 'connect' || mode === 'ray') {
            if (pendingFirstPointId === null) {
                pendingFirstPointId = pointId;
                highlightPoint(pointId, true);
                updateStatus();
            } else if (pendingFirstPointId !== pointId) {
                if (mode === 'connect') {
                    createConnection(pendingFirstPointId, pointId);
                } else {
                    createRay(pendingFirstPointId, pointId);
                }
                highlightPoint(pendingFirstPointId, false);
                pendingFirstPointId = null;
                updateStatus();
                // One-shot: the shape is complete, disarm back to idle.
                disarmGeometry();
            }
        } else if (mode === 'delete') {
            deletePointWithCascade(pointId);
            // One-shot: disarm after a single deletion. Kept here rather than
            // inside deletePointWithCascade, which the external point API also
            // calls programmatically and must not disarm.
            disarmGeometry();
        }
    }

    function highlightPoint(pointId, highlight) {
        const marker = pointMarkers[pointId];
        if (!marker) return;
        marker.setStyle({
            fillColor: highlight ? COLORS.pointPending : COLORS.point,
            radius: highlight ? 7 : 5,
            weight: highlight ? 3 : 2
        });
    }

    // ——— Connections ———

    function createConnection(ptAId, ptBId) {
        const conn = store.addConnection(ptAId, ptBId);
        const ptA = store.getPoint(ptAId);
        const ptB = store.getPoint(ptBId);
        const line = L.polyline([[ptA.lat, ptA.lon], [ptB.lat, ptB.lon]], {
            color: COLORS.connection,
            weight: 3,
            opacity: 0.8
        });
        line.connectionId = conn.id;
        line.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            if (mode === 'delete') {
                deleteConnection(conn.id);
            }
        });
        line.addTo(geometryLayer);
        connectionLines[conn.id] = line;
        updateElementList();
    }

    function deleteConnection(connId) {
        store.deleteConnection(connId);
        if (connectionLines[connId]) {
            geometryLayer.removeLayer(connectionLines[connId]);
            delete connectionLines[connId];
        }
        updateElementList();
        // One-shot: only ever reached from a delete-mode line click, so a
        // single deletion disarms the tool back to idle.
        disarmGeometry();
    }

    // ——— Rays ———

    function createRay(originId, throughId) {
        const ray = store.addRay(originId, throughId);
        const line = buildRayPolyline(ray);
        line.rayId = ray.id;
        line.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            if (mode === 'delete') {
                deleteRay(ray.id);
            }
        });
        line.addTo(geometryLayer);
        rayLines[ray.id] = line;
        updateElementList();
    }

    function buildRayPolyline(ray) {
        const origin = store.getPoint(ray.originPointId);
        const through = store.getPoint(ray.throughPointId);
        const endLatLng = extendRayToMapBounds(origin.lat, origin.lon, through.lat, through.lon);
        return L.polyline(
            [[origin.lat, origin.lon], [through.lat, through.lon], endLatLng],
            { color: COLORS.ray, weight: 2.5, opacity: 0.8, dashArray: '8, 5' }
        );
    }

    function extendRayToMapBounds(lat1, lon1, lat2, lon2) {
        // Use pixel coordinates for proper projection handling
        const p1 = map.latLngToContainerPoint([lat1, lon1]);
        const p2 = map.latLngToContainerPoint([lat2, lon2]);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return [lat2, lon2];

        // Extend far enough to cover the entire map view
        const size = map.getSize();
        const maxDist = Math.sqrt(size.x * size.x + size.y * size.y) * 2;
        const ux = dx / len;
        const uy = dy / len;
        const endPixel = L.point(p1.x + ux * maxDist, p1.y + uy * maxDist);
        const endLatLng = map.containerPointToLatLng(endPixel);
        return [endLatLng.lat, endLatLng.lng];
    }

    function updateAllRays() {
        for (const ray of store.rays) {
            if (rayLines[ray.id]) {
                geometryLayer.removeLayer(rayLines[ray.id]);
                const line = buildRayPolyline(ray);
                line.rayId = ray.id;
                line.on('click', function(e) {
                    L.DomEvent.stopPropagation(e);
                    if (mode === 'delete') deleteRay(ray.id);
                });
                line.addTo(geometryLayer);
                rayLines[ray.id] = line;
            }
        }
    }

    function deleteRay(rayId) {
        store.deleteRay(rayId);
        if (rayLines[rayId]) {
            geometryLayer.removeLayer(rayLines[rayId]);
            delete rayLines[rayId];
        }
        updateElementList();
        // One-shot: only ever reached from a delete-mode line click, so a
        // single deletion disarms the tool back to idle.
        disarmGeometry();
    }

    // ——— Deletion ———

    function deletePointWithCascade(pointId) {
        const result = store.deletePoint(pointId);
        for (const cId of result.removedConnectionIds) {
            if (connectionLines[cId]) {
                geometryLayer.removeLayer(connectionLines[cId]);
                delete connectionLines[cId];
            }
        }
        for (const rId of result.removedRayIds) {
            if (rayLines[rId]) {
                geometryLayer.removeLayer(rayLines[rId]);
                delete rayLines[rId];
            }
        }
        if (pointMarkers[pointId]) {
            geometryLayer.removeLayer(pointMarkers[pointId]);
            delete pointMarkers[pointId];
        }
        if (pendingFirstPointId === pointId) {
            pendingFirstPointId = null;
        }
        updateElementList();
    }

    function clearAll() {
        store.clearAll();
        geometryLayer.clearLayers();
        pointMarkers = {};
        connectionLines = {};
        rayLines = {};
        pendingFirstPointId = null;
        updateElementList();
    }

    // ——— Mode Switching ———

    /**
     * Thin delegate: arms/disarms the corresponding machine state.
     * `machine.toggle` already provides "click the active button to turn it
     * off" — the hand-rolled version of that lived here before. Button
     * updates, status text, pending-point clearing, cursor and preview ring
     * all now happen in the `registerInteractionStates()` subscriber /
     * state hooks, driven by the resulting transition rather than by this
     * function directly.
     */
    function setActiveMode(newMode) {
        if (!window.mapInteraction) return;
        const stateId = stateIdForModeString(newMode);
        if (!stateId) return;
        window.mapInteraction.toggle(stateId);
    }

    function stateIdForModeString(modeString) {
        switch (modeString) {
            case 'place_point': return window.GeometryStates.PLACE_POINT;
            case 'connect':     return window.GeometryStates.CONNECT;
            case 'ray':         return window.GeometryStates.RAY;
            case 'delete':      return window.GeometryStates.DELETE;
            default:            return null;
        }
    }

    /**
     * Unconditionally disarm geometry back to idle (panel close / control
     * removal). Unlike setActiveMode, this is not a toggle — it always
     * lands on idle regardless of which geometry mode, if any, was active.
     */
    function disarmGeometry() {
        if (!window.mapInteraction) return;
        window.mapInteraction.transitionTo(window.InteractionStates.IDLE);
    }

    /**
     * Subtle semi-transparent ring that follows the cursor while the user is
     * in "Place Point" mode — previews where the next point will land.
     */
    function enableCursorPreview() {
        if (previewCircle || !map) return;
        previewCircle = L.circleMarker(map.getCenter(), {
            radius: 10,
            color: COLORS.point,
            weight: 1.5,
            opacity: 0.6,
            fillColor: COLORS.point,
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

    function updateModeButtons() {
        const buttons = {
            'place_point': 'geometryLPlacePointBtn',
            'connect': 'geometryLConnectBtn',
            'ray': 'geometryLRayBtn',
            'delete': 'geometryLDeleteBtn'
        };
        for (const [m, btnId] of Object.entries(buttons)) {
            const btn = document.getElementById(btnId);
            if (!btn) continue;
            if (m === mode) {
                btn.style.outline = '3px solid #333';
                btn.style.outlineOffset = '-3px';
            } else {
                btn.style.outline = 'none';
            }
        }
    }

    function updateStatus() {
        const el = document.getElementById('geometryLStatus');
        if (!el) return;
        if (mode === 'place_point') {
            el.textContent = 'Click on map to place a point';
            el.style.color = '#4CAF50';
        } else if (mode === 'connect') {
            el.textContent = pendingFirstPointId ? 'Click second point to connect' : 'Click first point';
            el.style.color = '#2196F3';
        } else if (mode === 'ray') {
            el.textContent = pendingFirstPointId ? 'Click second point for ray direction' : 'Click origin point';
            el.style.color = '#FF9800';
        } else if (mode === 'delete') {
            el.textContent = 'Click any element to delete';
            el.style.color = '#f44336';
        } else {
            el.textContent = 'Select a mode above';
            el.style.color = '#666';
        }
    }

    function updateElementList() {
        const el = document.getElementById('geometryLStats');
        if (!el) return;
        const p = store.points.length;
        const c = store.connections.length;
        const r = store.rays.length;
        el.textContent = `${p} point${p !== 1 ? 's' : ''}, ${c} connection${c !== 1 ? 's' : ''}, ${r} ray${r !== 1 ? 's' : ''}`;
    }

    // ——— Control Panel ———

    function createControlPanel() {
        L.Control.Geometry = L.Control.extend({
            options: { position: 'topright' },

            onAdd: function() {
                const container = L.DomUtil.create('div', 'leaflet-control-geometry');
                container.style.cssText = 'background:white; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.3); margin-top:10px; min-width:200px;';

                container.innerHTML = `
                    <div id="geometryLHeader" style="padding:8px 10px; background:white; border-radius:4px 4px 0 0; font-weight:bold; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:6px;">
                        <span style="font-size:14px;">📐</span> Geometry Tools
                    </div>
                    <div id="geometryLPanel" style="display:none; padding:10px; padding-top:5px;">
                        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
                            <button id="geometryLPlacePointBtn" style="flex:1; min-width:45%; padding:6px 4px; border:none; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold; background:#4CAF50; color:white;">
                                📍 Place Point
                            </button>
                            <button id="geometryLConnectBtn" style="flex:1; min-width:45%; padding:6px 4px; border:none; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold; background:#2196F3; color:white;">
                                🔗 Connect
                            </button>
                            <button id="geometryLRayBtn" style="flex:1; min-width:45%; padding:6px 4px; border:none; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold; background:#FF9800; color:white;">
                                ➡️ Ray
                            </button>
                            <button id="geometryLDeleteBtn" style="flex:1; min-width:45%; padding:6px 4px; border:none; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold; background:#f44336; color:white;">
                                🗑️ Delete
                            </button>
                        </div>
                        <div id="geometryLStatus" style="text-align:center; font-size:11px; color:#666; margin-bottom:8px;">
                            Select a mode above
                        </div>
                        <div id="geometryLStats" style="font-size:11px; color:#333; margin-bottom:8px;">
                            0 points, 0 connections, 0 rays
                        </div>
                        <button id="geometryLClearAllBtn" style="width:100%; padding:6px; background:#757575; color:white; border:none; border-radius:3px; cursor:pointer; font-size:11px;">
                            Clear All
                        </button>
                    </div>
                `;

                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                return container;
            },

            onRemove: function() {
                disarmGeometry();
            }
        });

        new L.Control.Geometry().addTo(map);

        setTimeout(() => {
            const header = document.getElementById('geometryLHeader');
            const panel = document.getElementById('geometryLPanel');

            if (header && panel) {
                header.onclick = function(e) {
                    e.stopPropagation();
                    const isVisible = panel.style.display !== 'none';
                    panel.style.display = isVisible ? 'none' : 'block';
                    header.style.background = isVisible ? 'white' : '#fce4ec';
                    if (isVisible) {
                        disarmGeometry();
                    }
                };
            }

            const placeBtn = document.getElementById('geometryLPlacePointBtn');
            const connectBtn = document.getElementById('geometryLConnectBtn');
            const rayBtn = document.getElementById('geometryLRayBtn');
            const deleteBtn = document.getElementById('geometryLDeleteBtn');
            const clearBtn = document.getElementById('geometryLClearAllBtn');

            if (placeBtn) placeBtn.onclick = (e) => { e.stopPropagation(); setActiveMode('place_point'); };
            if (connectBtn) connectBtn.onclick = (e) => { e.stopPropagation(); setActiveMode('connect'); };
            if (rayBtn) rayBtn.onclick = (e) => { e.stopPropagation(); setActiveMode('ray'); };
            if (deleteBtn) deleteBtn.onclick = (e) => { e.stopPropagation(); setActiveMode('delete'); };
            if (clearBtn) clearBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Clear all geometry?')) {
                    clearAll();
                }
            };
        }, 100);
    }

    // ——— External Point API ———
    // Lets other modules (e.g. observed_position.js) register their own
    // markers as geometry points so Connect / Ray / Delete can target them.
    // The external module owns the marker's rendering; we just hold the
    // point in the store and redraw any lines that reference it.

    function rebuildLinesForPoint(pointId) {
        store.getConnectionsForPoint(pointId).forEach(conn => {
            if (!connectionLines[conn.id]) return;
            geometryLayer.removeLayer(connectionLines[conn.id]);
            const ptA = store.getPoint(conn.pointAId);
            const ptB = store.getPoint(conn.pointBId);
            const line = L.polyline([[ptA.lat, ptA.lon], [ptB.lat, ptB.lon]], {
                color: COLORS.connection, weight: 3, opacity: 0.8
            });
            line.connectionId = conn.id;
            line.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                if (mode === 'delete') deleteConnection(conn.id);
            });
            line.addTo(geometryLayer);
            connectionLines[conn.id] = line;
        });
        store.getRaysForPoint(pointId).forEach(ray => {
            if (!rayLines[ray.id]) return;
            geometryLayer.removeLayer(rayLines[ray.id]);
            const line = buildRayPolyline(ray);
            line.rayId = ray.id;
            line.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                if (mode === 'delete') deleteRay(ray.id);
            });
            line.addTo(geometryLayer);
            rayLines[ray.id] = line;
        });
    }

    window.GeometryLeaflet = {
        registerExternalPoint: function(lat, lng) {
            const pt = store.addPoint(lat, lng);
            updateElementList();
            return pt.id;
        },
        updateExternalPoint: function(pointId, lat, lng) {
            const pt = store.getPoint(pointId);
            if (!pt) return;
            pt.lat = lat;
            pt.lon = lng;
            rebuildLinesForPoint(pointId);
        },
        removeExternalPoint: function(pointId) {
            deletePointWithCascade(pointId);
        },
        isGeometryInteractionMode: function() {
            return mode === 'connect' || mode === 'ray' || mode === 'delete';
        },
        handleExternalPointClick: function(pointId) {
            handlePointClick(pointId);
        }
    };

})();
