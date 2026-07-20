/**
 * Nautical Divider for Leaflet Interactive Map
 * Adapts the canvas-based nautical divider to work with Leaflet maps
 */

(function() {
    'use strict';

    let map = null;
    let dividerCanvas = null;
    let dividerManager = null;
    let dividersVisible = false;

    // Create a simple mapper for Leaflet
    class LeafletCoordinateMapper {
        constructor(leafletMap) {
            this.map = leafletMap;
        }
        
        geographicToScreen(lat, lon) {
            const point = this.map.latLngToContainerPoint([lat, lon]);
            return { x: point.x, y: point.y };
        }
        
        screenToGeographic(screenX, screenY) {
            const latLng = this.map.containerPointToLatLng([screenX, screenY]);
            return { lat: latLng.lat, lon: latLng.lng };
        }
    }
    
    // Simple projection adapter
    class LeafletProjection {
        project(lat, lon) {
            // For Leaflet, we use the map's built-in projection
            return { x: lon, y: lat };
        }
        
        unproject(x, y) {
            return { lat: y, lon: x };
        }
    }

    /**
     * Initialize nautical divider on the Leaflet map
     * @param {L.Map} leafletMap - The Leaflet map instance
     */
    window.initNauticalDivider = function(leafletMap) {
        map = leafletMap;
        
        // Create canvas overlay pane
        map.createPane('dividerPane');
        map.getPane('dividerPane').style.zIndex = 660; // Above triangles (650)
        map.getPane('dividerPane').style.pointerEvents = 'none';
        
        // Create canvas layer
        const CanvasLayer = L.Layer.extend({
            onAdd: function(map) {
                const size = map.getSize();
                dividerCanvas = L.DomUtil.create('canvas', 'divider-overlay');
                dividerCanvas.width = size.x;
                dividerCanvas.height = size.y;
                dividerCanvas.style.position = 'absolute';
                dividerCanvas.style.left = '0px';
                dividerCanvas.style.top = '0px';
                // Default to letting clicks pass through to the markers/map
                // underneath (geometry points, etc.). updateCanvasPassthrough()
                // flips this to 'auto' only while the pointer is over a divider.
                dividerCanvas.style.pointerEvents = 'none';
                
                map.getPane('dividerPane').appendChild(dividerCanvas);
                // Pin to the viewport in case the map was already panned before
                // the divider was first shown.
                positionDividerCanvas();

                // Initialize divider manager
                const mapper = new LeafletCoordinateMapper(map);
                const projection = new LeafletProjection();
                dividerManager = new NauticalDividerManager(mapper, projection);
                
                // Setup mouse event handlers
                setupMouseHandlers();
                
                // Update on map move/zoom
                map.on('move zoom resize', this._update, this);
                
                // Initial render
                renderDividers();
            },
            
            onRemove: function(map) {
                if (dividerCanvas) {
                    L.DomUtil.remove(dividerCanvas);
                    dividerCanvas = null;
                }
                map.off('move zoom resize', this._update, this);
            },
            
            _update: function() {
                if (dividerCanvas) {
                    const size = map.getSize();
                    dividerCanvas.width = size.x;
                    dividerCanvas.height = size.y;
                    positionDividerCanvas();
                    renderDividers();
                }
            }
        });
        
        // Store canvas layer reference
        window.dividerCanvasLayer = new CanvasLayer();

        // Create custom control
        createDividerControl(map);

        // Register this tool's placement state with the interaction machine,
        // so arming divider placement is mutually exclusive with every other
        // placement tool (in particular geometry's "Place Point").
        registerInteractionState();

        // The divider canvas covers the whole viewport, so while shown it would
        // otherwise swallow every click and block other tools (e.g. clicking a
        // geometry point to delete it). Listen on the map container — which
        // always receives events even when the canvas is pass-through — and let
        // the canvas capture events only while the pointer is over a divider.
        map.getContainer().addEventListener('mousemove', function(e) {
            updateCanvasPassthrough(e.clientX, e.clientY);
        });

        console.log('✓ Nautical divider initialized');
    };

    /**
     * Register the divider's placement state with the interaction machine,
     * before the machine is started (see main_map.js), so registration order
     * is safe. NauticalDividerManager needs NO changes — it already tracks
     * its own two-step placement internally via placementPointA — this only
     * changes how placement is armed (via the machine instead of a direct
     * startPlacement() call) and where the placement click comes from (the
     * machine's TAP instead of the canvas's own mousedown).
     */
    function registerInteractionState() {
        if (!window.mapInteraction) return;

        window.mapInteraction.register(window.defineState({
            id: window.DividerStates.PLACING,
            tool: 'divider',
            cursor: 'crosshair',
            targets: [window.InteractionStates.IDLE],
            on: {
                TAP: function(event) {
                    if (!dividerManager || !dividerCanvas) return;

                    // The manager works in canvas-relative pixels; the TAP
                    // event's x/y are map-container-relative. Derive canvas
                    // coordinates from the underlying DOM event exactly as
                    // the canvas's own mouse handlers do below — do not
                    // assume the two coordinate spaces are the same.
                    const rect = dividerCanvas.getBoundingClientRect();
                    const x = event.originalEvent.clientX - rect.left;
                    const y = event.originalEvent.clientY - rect.top;

                    dividerManager.handleMouseDown(x, y);
                    renderDividers();
                    updateDividerInfo();
                    updateControlButtons();

                    // The second click completes the divider — the manager
                    // flips placementMode back to false itself. Stay armed
                    // otherwise, for the second end.
                    if (!dividerManager.placementMode) {
                        return window.InteractionStates.IDLE;
                    }
                },
                ESCAPE: function() {
                    return window.InteractionStates.IDLE;
                }
            },
            onEnter: function() {
                // Placement needs the canvas & manager to exist. If the
                // panel is collapsed, show it first — mirrors clicking
                // "Show Divider" (toggleDivider() flips dividersVisible from
                // false to true and does the show side-effects).
                if (!dividersVisible) {
                    toggleDivider();
                }
                if (dividerManager) {
                    dividerManager.startPlacement();
                    // Placement needs the canvas to capture clicks right
                    // away, before any mousemove has had a chance to flip
                    // pointerEvents on via updateCanvasPassthrough().
                    if (dividerCanvas) {
                        dividerCanvas.style.pointerEvents = 'auto';
                        // Let the crosshair cursor the machine applied to
                        // the map container show through (cursor inherits);
                        // the mousemove handler below stops overriding it
                        // with the manager's own cursor while armed.
                        dividerCanvas.style.cursor = '';
                    }
                }
                updateControlButtons();
                renderDividers();
            },
            onExit: function() {
                // Cancel-partial-work rule: discard a half-placed divider (a
                // lone placementPointA) when the user hits Escape or arms a
                // different tool mid-placement. A no-op when placement
                // already completed on its own (handleMouseDown already
                // cleared placementMode/placementPointA in that case).
                if (dividerManager) dividerManager.cancelPlacement();
                renderDividers();
                updateControlButtons();
            }
        }));

        // placementMode stays owned by the manager: onEnter/onExit above
        // already call startPlacement()/cancelPlacement(), which set that
        // flag themselves. This subscriber's job is only to keep the panel
        // and canvas in sync with machine-driven changes (e.g. the user
        // arming a different tool while a divider button is showing stale
        // text) — never to fight the manager over the flag.
        window.mapInteraction.subscribe(function() {
            updateControlButtons();
            renderDividers();
        });

        // Let the router know a divider is under the pointer, so it can
        // suppress a spurious TAP when a gesture starts on an existing
        // divider (e.g. clicking a handle while geometry "Place Point" is
        // armed must not also place a geometry point). dragState: null is
        // deliberate — dragging stays on the canvas's own mouse handlers
        // below, so idle's FEATURE_DOWN handler must not route anywhere for
        // this feature descriptor; the hit tester exists purely so the
        // router can suppress the TAP.
        if (window.mapInteractionRouter) {
            window.mapInteractionRouter.registerHitTester(function(x, y) {
                if (!dividersVisible || !dividerManager || !dividerCanvas) return null;
                // x/y are container-relative. Reconstruct the equivalent
                // canvas-relative point from the two elements' own
                // bounding rects rather than assuming the coordinate
                // spaces coincide, same rule as the TAP handler above.
                const containerRect = map.getContainer().getBoundingClientRect();
                const canvasRect = dividerCanvas.getBoundingClientRect();
                const cx = x + containerRect.left - canvasRect.left;
                const cy = y + containerRect.top - canvasRect.top;

                // Deliberately NOT isOverInteractive(): that returns true while
                // placementMode is set, which would classify a placement click
                // as "started on an existing feature" and suppress the very TAP
                // that placement depends on. Only an actual divider under the
                // pointer counts as a feature here.
                if (dividerManager.placementMode) return null;
                for (const divider of dividerManager.dividers) {
                    if (divider.hitTest(cx, cy) !== null) {
                        return { tool: 'divider', dragState: null };
                    }
                }
                return null;
            });
        }
    }

    /**
     * Toggle whether the divider canvas captures pointer events. It captures
     * only when the divider is visible and the pointer is over an interactive
     * part of a divider; otherwise clicks fall through to the map and any
     * markers beneath (geometry points, observed positions, etc.).
     */
    function updateCanvasPassthrough(clientX, clientY) {
        if (!dividerCanvas) return;
        if (!dividersVisible || !dividerManager) {
            dividerCanvas.style.pointerEvents = 'none';
            return;
        }
        const rect = dividerCanvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        dividerCanvas.style.pointerEvents =
            dividerManager.isOverInteractive(x, y) ? 'auto' : 'none';
    }
    
    /**
     * Create control panel for divider
     */
    function createDividerControl(map) {
        L.Control.NauticalDivider = L.Control.extend({
            options: {
                position: 'topright'
            },
            
            onAdd: function() {
                const container = L.DomUtil.create('div', 'divider-control');
                container.style.background = 'white';
                container.style.border = '2px solid rgba(0,0,0,0.2)';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                container.style.marginTop = '10px';
                container.style.cursor = 'pointer';
                
                container.innerHTML = `
                    <div id="dividerPanelToggle" style="padding: 8px 10px; background: white; border-radius: 4px; font-weight: bold; font-size: 12px;">
                        📏 Nautical Divider
                    </div>
                    <div id="dividerPanelContent" style="display: none; padding: 10px; padding-top: 0; min-width: 220px;">
                        <button id="toggleDividerBtn"
                            style="width:100%; padding:6px; margin-bottom:5px; cursor:pointer; background:#FF8800; color:white; border:none; border-radius:3px; font-weight:bold; font-size:11px;">
                        Show Divider
                    </button>
                    <div id="dividerControls" style="display:none;">
                        <button id="addDividerBtn" 
                                style="width:100%; padding:6px; margin-bottom:5px; cursor:pointer; background:#4CAF50; color:white; border:none; border-radius:3px; font-weight:bold; font-size:11px;">
                            Add New Divider
                        </button>
                        <button id="deleteDividerBtn" 
                                style="width:100%; padding:5px; margin-bottom:5px; cursor:pointer; background:#dc3545; color:white; border:none; border-radius:3px; font-size:10px; display:none;">
                            Delete Selected
                        </button>
                        <button id="clearDividersBtn" 
                                style="width:100%; padding:5px; margin-bottom:5px; cursor:pointer; background:#6c757d; color:white; border:none; border-radius:3px; font-size:10px; display:none;">
                            Clear All
                        </button>
                        <div id="dividerInfo" style="display:none; background:#e3f2fd; border:1px solid #0078A8; border-radius:3px; padding:8px; margin-top:8px; font-size:10px;">
                            <strong>Instructions:</strong>
                            <ul style="margin:4px 0 0 16px; padding:0; font-size:9px;">
                                <li>Click 2 points to place divider</li>
                                <li>Drag center (blue) to move</li>
                                <li>Drag green handle to rotate</li>
                                <li>Drag orange ends to pivot</li>
                            </ul>
                        </div>
                        <div id="selectedDividerInfo" style="display:none; background:#fff; border:1px solid #ddd; border-radius:3px; padding:8px; margin-top:8px; font-family:monospace; font-size:10px;">
                            <strong>Selected Divider:</strong>
                            <div id="dividerDistance" style="margin-top:3px;">Distance: -- NM</div>
                            <div id="dividerBearing" style="margin-top:3px;">Bearing: --°</div>
                        </div>
                        </div>
                    </div>
                `;
                
                L.DomEvent.disableClickPropagation(container);
                
                // Setup button handlers
                setTimeout(() => {
                    const panelToggle = document.getElementById('dividerPanelToggle');
                    const panelContent = document.getElementById('dividerPanelContent');
                    const toggleBtn = document.getElementById('toggleDividerBtn');
                    const addBtn = document.getElementById('addDividerBtn');
                    const deleteBtn = document.getElementById('deleteDividerBtn');
                    const clearBtn = document.getElementById('clearDividersBtn');
                    
                    // Toggle panel visibility
                    if (panelToggle && panelContent) {
                        panelToggle.onclick = function(e) {
                            e.stopPropagation();
                            const isVisible = panelContent.style.display !== 'none';
                            panelContent.style.display = isVisible ? 'none' : 'block';
                            panelToggle.style.background = isVisible ? 'white' : '#e8f5e9';
                        };
                    }
                    
                    if (toggleBtn) toggleBtn.onclick = toggleDivider;
                    // Routed through the machine so arming placement is
                    // mutually exclusive with every other placement tool.
                    // updateControlButtons() re-wires this same handler once
                    // dividerManager exists (see below); this initial wiring
                    // covers the window before that, e.g. a click that shows
                    // the divider and starts placement in the same session.
                    if (addBtn) addBtn.onclick = toggleDividerPlacement;
                    if (deleteBtn) deleteBtn.onclick = deleteSelected;
                    if (clearBtn) clearBtn.onclick = clearAll;
                }, 100);
                
                return container;
            }
        });
        
        // Add control to map
        new L.Control.NauticalDivider().addTo(map);
    }
    
    /**
     * Setup mouse event handlers on canvas
     */
    function setupMouseHandlers() {
        if (!dividerCanvas) return;
        
        dividerCanvas.addEventListener('mousedown', function(e) {
            if (!dividersVisible || !dividerManager) return;

            // Placement now arrives via the interaction machine's TAP (see
            // registerInteractionState()), not this handler. Without this
            // guard, a single placement click would be handled twice — once
            // here, once via TAP — placing two divider points per click.
            // Dragging an existing divider is unaffected: it only ever runs
            // with no tool armed, i.e. placementMode is always false then.
            if (dividerManager.placementMode) return;

            const rect = dividerCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const handled = dividerManager.handleMouseDown(x, y);
            if (handled) {
                // Only lock map pan/zoom while actually dragging a divider.
                // A placement click isn't a drag; locking on it left the map
                // stuck until the pointer happened to leave the canvas.
                if (dividerManager.isDragging) {
                    disableMapInteractions();
                }
                renderDividers();
                updateDividerInfo();
                // Refresh the button state so that when the second placement
                // click finishes a divider (placementMode -> false) the button
                // returns to "Add New Divider". Without this it stayed on
                // "Cancel Placement", so the next click cancelled instead of
                // starting a new divider.
                updateControlButtons();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        dividerCanvas.addEventListener('mousemove', function(e) {
            if (!dividersVisible || !dividerManager) return;
            
            const rect = dividerCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Update preview for placement mode
            dividerManager.setPreviewMouse(x, y);
            
            const handled = dividerManager.handleMouseMove(x, y);
            const cursor = dividerManager.updateCursor(x, y);
            // While placement is armed, the machine's state cursor
            // ('crosshair', applied to the map container) already covers it
            // — registerInteractionState()'s onEnter clears this element's
            // own cursor so it inherits that instead of fighting it here.
            if (!dividerManager.placementMode) {
                dividerCanvas.style.cursor = cursor;
            }

            if (handled) {
                renderDividers();
                updateDividerInfo();
                e.preventDefault();
                e.stopPropagation();
            } else if (dividerManager.placementMode) {
                renderDividers(); // Render preview
            } else if (dividerManager.hoverStateChanged()) {
                renderDividers(); // Toggle distance label on hover
            }
        });
        
        dividerCanvas.addEventListener('mouseup', function(e) {
            if (!dividersVisible || !dividerManager) return;
            
            const handled = dividerManager.handleMouseUp();
            if (handled) {
                enableMapInteractions();
                renderDividers();
                updateDividerInfo();
                updateControlButtons();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        dividerCanvas.addEventListener('mouseleave', function(e) {
            if (!dividersVisible || !dividerManager) return;
            dividerManager.handleMouseUp();
            dividerManager.dividers.forEach(d => d.isHovered = false);
            enableMapInteractions();
            renderDividers();
        });
    }
    
    /**
     * Suppress Leaflet map pan/zoom while a divider is being dragged, so the
     * chart holds still under the cursor. The divider itself is driven by the
     * canvas mouse handlers, not by map.dragging, so it keeps working here.
     */
    function disableMapInteractions() {
        if (!map) return;

        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
    }

    /**
     * Restore Leaflet map interactions after a divider drag. The global map
     * lock (window.mapInteractionLocked) is the single source of truth: if the
     * user locked the map, leave it locked; otherwise re-enable pan/zoom.
     */
    function enableMapInteractions() {
        if (!map) return;
        if (window.mapInteractionLocked) return;

        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
    }

    /**
     * Keep the full-screen canvas pinned to the map viewport. The canvas lives
     * in a Leaflet pane that is translated as the map pans, so without this it
     * drifts off-screen after a large pan/zoom — clicks then miss it entirely
     * and the divider tool appears dead, and drawn dividers land offset from
     * where you click. Positioning the canvas at the current top-left layer
     * point cancels the pane translation, so canvas pixel (0,0) always sits at
     * viewport (0,0) — matching the container-point coordinates that
     * renderDividers and the mouse hit-tests use.
     */
    function positionDividerCanvas() {
        if (!dividerCanvas || !map) return;
        L.DomUtil.setPosition(dividerCanvas, map.containerPointToLayerPoint([0, 0]));
    }

    /**
     * Render dividers on canvas
     */
    function renderDividers() {
        if (!dividerCanvas || !dividerManager) return;
        
        const ctx = dividerCanvas.getContext('2d');
        ctx.clearRect(0, 0, dividerCanvas.width, dividerCanvas.height);
        
        if (dividersVisible) {
            dividerManager.drawAll(ctx);
        }
    }
    
    /**
     * Toggle divider visibility
     */
    function toggleDivider() {
        dividersVisible = !dividersVisible;
        
        const btn = document.getElementById('toggleDividerBtn');
        const controls = document.getElementById('dividerControls');
        const info = document.getElementById('dividerInfo');
        
        if (dividersVisible) {
            // Show divider
            if (window.dividerCanvasLayer && map) {
                window.dividerCanvasLayer.addTo(map);
            }
            
            btn.textContent = 'Hide Divider';
            btn.style.background = '#dc3545';
            controls.style.display = 'block';
            info.style.display = 'block';
            
            renderDividers();
        } else {
            // Hide divider
            if (window.dividerCanvasLayer && map) {
                map.removeLayer(window.dividerCanvasLayer);
            }
            
            // Cancel placement if active. Route through the machine when it
            // owns the current state, so the two never desync — its onExit
            // already calls dividerManager.cancelPlacement() for us. Fall
            // back to the direct call only when the machine is absent.
            if (window.mapInteraction && window.mapInteraction.isActive(window.DividerStates.PLACING)) {
                window.mapInteraction.transitionTo(window.InteractionStates.IDLE);
            } else if (dividerManager) {
                dividerManager.cancelPlacement();
            }

            // Restore map interactions (unless the user has locked the map)
            enableMapInteractions();

            btn.textContent = 'Show Divider';
            btn.style.background = '#FF8800';
            controls.style.display = 'none';
            
            if (dividerCanvas) {
                const ctx = dividerCanvas.getContext('2d');
                ctx.clearRect(0, 0, dividerCanvas.width, dividerCanvas.height);
            }
        }
        
        updateControlButtons();
    }
    
    /**
     * "Add New Divider" / "Cancel Placement" button handler. Thin delegate:
     * arms or disarms the PLACING state via the machine's toggle (arms if
     * idle, disarms back to idle if placement is already active — including
     * mid-flow, cancelling a half-placed divider via the state's onExit).
     * Actually starting/cancelling placement on the manager, refreshing the
     * button and re-rendering all happen in registerInteractionState()'s
     * onEnter/onExit, not here.
     */
    function toggleDividerPlacement() {
        if (!window.mapInteraction) return;
        window.mapInteraction.toggle(window.DividerStates.PLACING);
    }
    
    /**
     * Delete selected divider
     */
    function deleteSelected() {
        if (dividerManager && dividerManager.deleteSelected()) {
            renderDividers();
            updateControlButtons();
            updateDividerInfo();
        }
    }
    
    /**
     * Clear all dividers
     */
    function clearAll() {
        if (dividerManager && confirm('Clear all dividers?')) {
            dividerManager.clearAll();
            renderDividers();
            updateControlButtons();
            updateDividerInfo();
        }
    }
    
    /**
     * Update control button states
     */
    function updateControlButtons() {
        if (!dividerManager) return;
        
        const addBtn = document.getElementById('addDividerBtn');
        const deleteBtn = document.getElementById('deleteDividerBtn');
        const clearBtn = document.getElementById('clearDividersBtn');
        
        if (addBtn) {
            if (dividerManager.placementMode) {
                addBtn.textContent = 'Cancel Placement';
                addBtn.style.background = '#dc3545';
            } else {
                addBtn.textContent = 'Add New Divider';
                addBtn.style.background = '#4CAF50';
            }
            // Always routed through the machine's toggle (see
            // toggleDividerPlacement) so a cancel click disarms the machine
            // too, rather than only the manager's own flag.
            addBtn.onclick = toggleDividerPlacement;
        }
        
        if (deleteBtn) {
            deleteBtn.style.display = dividerManager.selectedDivider ? 'block' : 'none';
        }
        
        if (clearBtn) {
            clearBtn.style.display = dividerManager.dividers.length > 0 ? 'block' : 'none';
        }
    }
    
    /**
     * Update divider info display
     */
    function updateDividerInfo() {
        if (!dividerManager) return;
        
        const infoDiv = document.getElementById('selectedDividerInfo');
        const distanceDiv = document.getElementById('dividerDistance');
        const bearingDiv = document.getElementById('dividerBearing');
        
        if (!infoDiv || !distanceDiv || !bearingDiv) return;
        
        const info = dividerManager.getSelectedInfo();
        
        if (info) {
            infoDiv.style.display = 'block';
            distanceDiv.textContent = `Distance: ${info.distance.toFixed(2)} NM`;
            bearingDiv.textContent = `Bearing: ${Math.round(info.bearing)}°`;
        } else {
            infoDiv.style.display = 'none';
        }
    }
    
    // Update divider info periodically when visible
    setInterval(() => {
        if (dividersVisible && dividerManager && dividerManager.selectedDivider) {
            updateDividerInfo();
        }
    }, 100);

})();