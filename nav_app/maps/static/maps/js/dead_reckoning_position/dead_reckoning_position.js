/**
 * Dead Reckoning Position Tool
 * Marks worked-out positions on the nautical map
 * Icon: Circle with a dot inside (against the observed position's circle with a cross)
 *
 * The marker itself — symbol, popup, description, dragging, the geometry point
 * behind it and the side list — comes from core/annotatable_marker.js, shared
 * with the observed position tool. What lives here is what belongs to THIS tool:
 * its control panel, its cursor preview and its placement state in the
 * interaction machine.
 *
 * Placement goes through the machine's TAP, never through a Leaflet listener of
 * its own: two tools listening to the same click was a bug once already.
 */

(function() {
    'use strict';

    const KIND = 'dr';
    const COLOR = '#1565C0';

    let map = null;
    let drPositionLayer = null;
    // Derived from the interaction machine via a subscribe callback below.
    let isPlacingMode = false;
    let previewCircle = null;

    /** Circle with a dot: the chart symbol for a dead reckoning position. */
    function drIcon(size, color) {
        const w = 2;
        return `
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - w}"
                    fill="none" stroke="${color}" stroke-width="${w}"/>
                <circle cx="${size / 2}" cy="${size / 2}" r="${Math.max(1.5, size * 0.12)}"
                    fill="${color}"/>
            </svg>`;
    }

    /**
     * Add a dead reckoning position at given coordinates
     */
    function addDeadReckoningPosition(lat, lng) {
        return window.AnnotatableMarker.create({
            kindId: KIND, lat: lat, lon: lng,
            map: map, layer: drPositionLayer,
            onChange: updatePositionList,
        });
    }

    /**
     * Update the position list in the control panel
     */
    function updatePositionList() {
        window.AnnotatableMarker.renderList(
            document.getElementById('drPositionList'), drPositionLayer);
    }

    /** Placing a point from typed coordinates (see the Go to Position control). */
    window.DeadReckoningPosition = { add: addDeadReckoningPosition };

    /**
     * Toggle placing mode.
     *
     * Delegates to the interaction machine, which owns the flag, the cursor
     * and (via the state's onEnter/onExit) the visual side-effects.
     */
    function togglePlacingMode(enabled) {
        if (!window.mapInteraction) return;
        window.mapInteraction.transitionTo(
            enabled ? window.DeadReckoningStates.PLACING : window.InteractionStates.IDLE
        );
    }

    /**
     * Cursor preview circle: semi-transparent ring that trails the mouse while
     * placement mode is active, so the user can see exactly where the next
     * position will land before clicking.
     */
    function enableCursorPreview() {
        if (previewCircle || !map) return;
        previewCircle = L.circleMarker(map.getCenter(), {
            radius: 12,
            color: COLOR,
            weight: 1.5,
            opacity: 0.65,
            fillColor: COLOR,
            fillOpacity: 0.15,
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
     * Create the control panel
     */
    function createControlPanel() {
        L.Control.DeadReckoningPosition = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: function() {
                const container = L.DomUtil.create('div', 'leaflet-control-dr-position');
                container.style.cssText = `
                    background: white;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    margin-top: 10px;
                    min-width: 200px;
                `;

                container.innerHTML = `
                    <div id="drPositionHeader" style="padding: 8px 10px; background: white; border-radius: 4px 4px 0 0; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 16px;">⊙</span> Dead Reckoning
                    </div>
                    <div id="drPositionPanel" style="display: none; padding: 10px; padding-top: 5px;">
                        <div style="margin-bottom: 10px;">
                            <button id="drPositionToggle" style="
                                width: 100%; padding: 8px; background: #4CAF50; color: white;
                                border: none; border-radius: 3px; cursor: pointer;
                                font-weight: bold; font-size: 12px;">
                                Start Marking
                            </button>
                        </div>
                        <div id="drPositionStatus" style="text-align: center; font-size: 11px; color: #666; margin-bottom: 10px;">
                            Click button to start
                        </div>
                        <div style="border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;">
                            <div style="font-weight: bold; font-size: 11px; margin-bottom: 5px; color: #333;">
                                Marked Positions:
                            </div>
                            <div id="drPositionList" style="max-height: 150px; overflow-y: auto;">
                                <div style="color: #999; font-style: italic; font-size: 11px;">No positions marked</div>
                            </div>
                        </div>
                        <div style="margin-top: 10px;">
                            <button id="drClearAll" style="
                                width: 100%; padding: 6px; background: #757575; color: white;
                                border: none; border-radius: 3px; cursor: pointer;
                                font-size: 11px;">
                                Clear All
                            </button>
                        </div>
                    </div>
                `;

                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                return container;
            },

            onRemove: function() {
                togglePlacingMode(false);
            }
        });

        new L.Control.DeadReckoningPosition().addTo(map);

        // Setup event handlers after DOM is ready
        setTimeout(() => {
            const header = document.getElementById('drPositionHeader');
            const panel = document.getElementById('drPositionPanel');
            const toggleBtn = document.getElementById('drPositionToggle');
            const clearBtn = document.getElementById('drClearAll');

            // Toggle panel visibility
            if (header && panel) {
                header.onclick = function(e) {
                    e.stopPropagation();
                    const isVisible = panel.style.display !== 'none';
                    panel.style.display = isVisible ? 'none' : 'block';
                    header.style.background = isVisible ? 'white' : '#e3f2fd';

                    // Disable placing mode when closing panel
                    if (isVisible && isPlacingMode) {
                        togglePlacingMode(false);
                    }
                };
            }

            // Toggle placing mode — routed through the machine so it is
            // mutually exclusive with every other placement tool.
            if (toggleBtn) {
                toggleBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (window.mapInteraction) {
                        window.mapInteraction.toggle(window.DeadReckoningStates.PLACING);
                    }
                };
            }

            // Clear all positions
            if (clearBtn) {
                clearBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (confirm('Clear all dead reckoning positions?')) {
                        window.AnnotatableMarker.clear(KIND, drPositionLayer);
                        updatePositionList();
                    }
                };
            }
        }, 100);
    }

    /**
     * Register this tool's placement state with the interaction machine.
     * Called from init, before the machine is started (see interaction_setup.js
     * / main_map.js), so registration order is safe.
     */
    function registerInteractionState() {
        if (!window.mapInteraction) return;

        window.mapInteraction.register(window.defineState({
            id: window.DeadReckoningStates.PLACING,
            tool: 'deadReckoningPosition',
            cursor: 'crosshair',
            targets: [window.InteractionStates.IDLE],
            on: {
                TAP: function(event) {
                    addDeadReckoningPosition(event.lat, event.lng);
                    // One position per "Start Marking", exactly like the
                    // observed position tool.
                    return window.InteractionStates.IDLE;
                },
                ESCAPE: function() {
                    return window.InteractionStates.IDLE;
                }
            },
            onEnter: function() {
                const btn = document.getElementById('drPositionToggle');
                const statusText = document.getElementById('drPositionStatus');
                if (btn) {
                    btn.style.background = '#D32F2F';
                    btn.textContent = 'Stop Marking';
                }
                if (statusText) {
                    statusText.textContent = 'Click the map to mark one position';
                    statusText.style.color = '#D32F2F';
                }
                enableCursorPreview();
            },
            onExit: function() {
                const btn = document.getElementById('drPositionToggle');
                const statusText = document.getElementById('drPositionStatus');
                if (btn) {
                    btn.style.background = '#4CAF50';
                    btn.textContent = 'Start Marking';
                }
                if (statusText) {
                    statusText.textContent = 'Click button to start';
                    statusText.style.color = '#666';
                }
                disableCursorPreview();
            }
        }));

        window.mapInteraction.subscribe(function() {
            isPlacingMode = window.mapInteraction.isActive(window.DeadReckoningStates.PLACING);
        });
    }

    /**
     * Initialize the Dead Reckoning Position tool
     */
    window.initDeadReckoningPosition = function(leafletMap) {
        map = leafletMap;
        drPositionLayer = L.layerGroup().addTo(map);

        window.AnnotatableMarker.defineKind({
            id: KIND, label: 'Dead Reckoning', badge: '⊙', color: COLOR, icon: drIcon,
        });

        createControlPanel();
        registerInteractionState();

        console.log('✓ Dead Reckoning Position tool initialized');
    };

})();
