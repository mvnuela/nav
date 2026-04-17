/**
 * Observed Position Marker Tool
 * Allows marking observed positions (fixes) on the nautical map
 * Icon: Circle with X inside (classic navigation symbol for a fix)
 */

(function() {
    'use strict';

    let map = null;
    let observedPositionLayer = null;
    let isPlacingMode = false;
    let positionCounter = 0;
    let previewCircle = null;

    /**
     * Create SVG icon for observed position (circle with X)
     */
    function createObservedPositionIcon(size = 24, color = '#000') {
        const strokeWidth = 2;


        const svg = `
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2 - strokeWidth}"
                    fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>
                <line x1="${size * 0.25}" y1="${size * 0.25}" x2="${size * 0.75}" y2="${size * 0.75}"
                    stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
                <line x1="${size * 0.75}" y1="${size * 0.25}" x2="${size * 0.25}" y2="${size * 0.75}"
                    stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
            </svg>
        `;
        return svg;
    }

    /**
     * Format time as HH:MM
     */
    function formatTime(date) {
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Add observed position marker at given coordinates
     */
    function addObservedPosition(lat, lng) {
        positionCounter++;
        const timestamp = new Date();
        const iconSize = 20;

        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'observed-position-marker',
                html: `<div style="filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.3));">${createObservedPositionIcon(iconSize)}</div>`,
                iconSize: [iconSize, iconSize],
                iconAnchor: [iconSize/2, iconSize/2]
            }),
            draggable: true
        });

        // Store metadata
        marker.positionData = {
            id: positionCounter,
            timestamp: timestamp,
            lat: lat,
            lng: lng,
            description: ''
        };

        // Create popup content
        const popupContent = createPopupContent(marker);
        marker.bindPopup(popupContent, { maxWidth: 250 });

        // Update position data when dragged
        marker.on('dragend', function(e) {
            const newPos = e.target.getLatLng();
            marker.positionData.lat = newPos.lat;
            marker.positionData.lng = newPos.lng;
            marker.setPopupContent(createPopupContent(marker));
            updatePositionList();
        });

        marker.addTo(observedPositionLayer);
        updatePositionList();

        return marker;
    }

    /**
     * Split a stored fraction string ("num/den") back into its parts
     */
    function parseFraction(str) {
        if (!str) return { numerator: '', denominator: '' };
        const idx = str.indexOf('/');
        if (idx === -1) return { numerator: str, denominator: '' };
        return {
            numerator: str.slice(0, idx),
            denominator: str.slice(idx + 1)
        };
    }

    /**
     * Escape HTML for safe attribute insertion
     */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Create popup content for marker
     */
    function createPopupContent(marker) {
        const data = marker.positionData;
        const latStr = typeof decimalToNautical === 'function'
            ? decimalToNautical(data.lat, true)
            : data.lat.toFixed(4);
        const lngStr = typeof decimalToNautical === 'function'
            ? decimalToNautical(data.lng, false)
            : data.lng.toFixed(4);

        return `
            <div style="font-family: Arial, sans-serif; font-size: 12px;">
                <div style="font-weight: bold; color: #D32F2F; margin-bottom: 5px;">
                    ⊗ Observed Position #${data.id}
                </div>
                <div style="margin-bottom: 3px;">
                    <strong>Lat:</strong> ${latStr}
                </div>
                <div style="margin-bottom: 3px;">
                    <strong>Lon:</strong> ${lngStr}
                </div>
                <div style="margin-bottom: 8px; color: #666;">
                    <strong>Time:</strong> ${formatTime(data.timestamp)}
                </div>
                <div style="margin-bottom: 6px;">
                    <label style="font-weight: bold; display: block; margin-bottom: 3px;">Description:</label>
                    <div style="display: inline-flex; flex-direction: column; align-items: center; font-family: monospace;">
                        <input id="observedPositionNum-${data.id}" type="text"
                            value="${escapeHtml(parseFraction(data.description).numerator)}"
                            style="width: 60px; text-align: center; padding: 2px; font-size: 12px;
                            border: 1px solid #ccc; border-radius: 3px; font-family: inherit;">
                        <div style="width: 60px; border-top: 1px solid #333; margin: 2px 0;"></div>
                        <input id="observedPositionDen-${data.id}" type="text"
                            value="${escapeHtml(parseFraction(data.description).denominator)}"
                            style="width: 60px; text-align: center; padding: 2px; font-size: 12px;
                            border: 1px solid #ccc; border-radius: 3px; font-family: inherit;">
                    </div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button onclick="window.saveObservedPositionDescription(${data.id})"
                        style="flex: 1; background: #1976D2; color: white; border: none; padding: 4px 10px;
                        border-radius: 3px; cursor: pointer; font-size: 11px;">
                        Save
                    </button>
                    <button onclick="window.deleteObservedPosition(${data.id})"
                        style="flex: 1; background: #D32F2F; color: white; border: none; padding: 4px 10px;
                        border-radius: 3px; cursor: pointer; font-size: 11px;">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Save description (numerator/denominator fraction) from popup inputs
     */
    window.saveObservedPositionDescription = function(id) {
        const numEl = document.getElementById('observedPositionNum-' + id);
        const denEl = document.getElementById('observedPositionDen-' + id);
        if (!numEl || !denEl) return;
        const num = numEl.value.trim();
        const den = denEl.value.trim();
        const fraction = (num || den) ? `${num}/${den}` : '';
        observedPositionLayer.eachLayer(function(layer) {
            if (layer.positionData && layer.positionData.id === id) {
                layer.positionData.description = fraction;
                layer.setPopupContent(createPopupContent(layer));
            }
        });
        updatePositionList();
    };

    /**
     * Delete observed position by ID
     */
    window.deleteObservedPosition = function(id) {
        // Collect first, then remove — mutating during eachLayer can skip entries
        const toRemove = [];
        observedPositionLayer.eachLayer(function(layer) {
            if (layer.positionData && layer.positionData.id === id) {
                toRemove.push(layer);
            }
        });
        toRemove.forEach(function(layer) {
            layer.closePopup && layer.closePopup();
            observedPositionLayer.removeLayer(layer);
            if (map && map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        updatePositionList();
    };

    /**
     * Clear all observed positions
     */
    function clearAllPositions() {
        observedPositionLayer.clearLayers();
        positionCounter = 0;
        updatePositionList();
    }

    /**
     * Attach a single delegated click listener to the side list so that
     * rebuilding via innerHTML doesn't drop the delete handlers.
     */
    function ensureListDelegation(listContainer) {
        if (listContainer._deleteDelegationAttached) return;
        listContainer._deleteDelegationAttached = true;
        listContainer.addEventListener('click', function(e) {
            const deleteBtn = e.target.closest('[data-delete-id]');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(deleteBtn.getAttribute('data-delete-id'), 10);
                if (!Number.isNaN(id)) {
                    window.deleteObservedPosition(id);
                }
                return;
            }
            const saveBtn = e.target.closest('[data-save-id]');
            if (saveBtn) {
                e.preventDefault();
                e.stopPropagation();
                const id = parseInt(saveBtn.getAttribute('data-save-id'), 10);
                if (!Number.isNaN(id)) {
                    window.saveObservedPositionDescriptionFromList(id);
                }
            }
        });
    }

    /**
     * Update the position list in the control panel
     */
    function updatePositionList() {
        const listContainer = document.getElementById('observedPositionList');
        if (!listContainer) return;
        ensureListDelegation(listContainer);

        const positions = [];
        observedPositionLayer.eachLayer(function(layer) {
            if (layer.positionData) {
                positions.push(layer.positionData);
            }
        });

        if (positions.length === 0) {
            listContainer.innerHTML = '<div style="color: #999; font-style: italic; font-size: 11px;">No positions marked</div>';
            return;
        }

        // Don't rebuild if the user is currently typing into one of the
        // list's fraction inputs — the re-render would clobber their text.
        const active = document.activeElement;
        if (active && active.id && /^observedPositionList(Num|Den)-/.test(active.id)) {
            return;
        }

        // Sort by ID
        positions.sort((a, b) => a.id - b.id);

        let html = '';
        positions.forEach(pos => {
            const latStr = typeof decimalToNautical === 'function'
                ? decimalToNautical(pos.lat, true)
                : pos.lat.toFixed(4);
            const lngStr = typeof decimalToNautical === 'function'
                ? decimalToNautical(pos.lng, false)
                : pos.lng.toFixed(4);

            const { numerator: numVal, denominator: denVal } = parseFraction(pos.description);
            const numEsc = escapeHtml(numVal);
            const denEsc = escapeHtml(denVal);

            html += `
                <div style="padding: 6px; margin-bottom: 4px; background: #f5f5f5; border-radius: 4px; font-size: 0.85em;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                        <span style="font-weight: bold; color: #D32F2F;">⊗ #${pos.id}</span>
                        <span style="color: #666; flex: 1; text-align: right;">${formatTime(pos.timestamp)}</span>
                        <button type="button" data-delete-id="${pos.id}"
                            title="Remove this position"
                            style="background: #D32F2F; color: white; border: none; padding: 2px 6px;
                            border-radius: 3px; cursor: pointer; font-size: 12px; line-height: 1;">×</button>
                    </div>
                    <div style="margin-top: 2px; color: #333; font-family: monospace; font-size: 0.9em;">
                        ${latStr}, ${lngStr}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                        <span style="color: #555; font-size: 0.85em;">Description:</span>
                        <div style="display: inline-flex; flex-direction: column; align-items: center; font-family: monospace;">
                            <input type="text" id="observedPositionListNum-${pos.id}" value="${numEsc}"
                                style="width: 48px; text-align: center; padding: 1px 2px; font-size: 11px;
                                border: 1px solid #ccc; border-radius: 3px;">
                            <div style="width: 48px; border-top: 1px solid #333; margin: 1px 0;"></div>
                            <input type="text" id="observedPositionListDen-${pos.id}" value="${denEsc}"
                                style="width: 48px; text-align: center; padding: 1px 2px; font-size: 11px;
                                border: 1px solid #ccc; border-radius: 3px;">
                        </div>
                        <button type="button" data-save-id="${pos.id}"
                            style="background: #1976D2; color: white; border: none; padding: 2px 8px;
                            border-radius: 3px; cursor: pointer; font-size: 11px;">Save</button>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    }

    /**
     * Save description edited via the side-panel list (distinct IDs from the
     * marker popup so the two editors can coexist).
     */
    window.saveObservedPositionDescriptionFromList = function(id) {
        const numEl = document.getElementById('observedPositionListNum-' + id);
        const denEl = document.getElementById('observedPositionListDen-' + id);
        if (!numEl || !denEl) return;
        const num = numEl.value.trim();
        const den = denEl.value.trim();
        const fraction = (num || den) ? `${num}/${den}` : '';
        observedPositionLayer.eachLayer(function(layer) {
            if (layer.positionData && layer.positionData.id === id) {
                layer.positionData.description = fraction;
                layer.setPopupContent(createPopupContent(layer));
            }
        });
        updatePositionList();
    };

    /**
     * Handle map click when in placing mode
     */
    function onMapClick(e) {
        if (!isPlacingMode) return;
        addObservedPosition(e.latlng.lat, e.latlng.lng);
    }

    /**
     * Toggle placing mode
     */
    function togglePlacingMode(enabled) {
        isPlacingMode = enabled;
        const btn = document.getElementById('observedPositionToggle');
        const statusText = document.getElementById('observedPositionStatus');

        if (btn) {
            btn.style.background = enabled ? '#D32F2F' : '#4CAF50';
            btn.textContent = enabled ? 'Stop Marking' : 'Start Marking';
        }

        if (statusText) {
            statusText.textContent = enabled ? 'Click on map to mark position' : 'Click button to start';
            statusText.style.color = enabled ? '#D32F2F' : '#666';
        }

        // Change cursor
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.style.cursor = enabled ? 'crosshair' : '';
        }

        if (enabled) {
            enableCursorPreview();
        } else {
            disableCursorPreview();
        }
    }

    /**
     * Cursor preview circle: semi-transparent ring that trails the mouse while
     * placement mode is active, so the user can see exactly where the next fix
     * will land before clicking.
     */
    function enableCursorPreview() {
        if (previewCircle || !map) return;
        previewCircle = L.circleMarker(map.getCenter(), {
            radius: 12,
            color: '#D32F2F',
            weight: 1.5,
            opacity: 0.65,
            fillColor: '#D32F2F',
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
        L.Control.ObservedPosition = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-control-observed-position');
                container.style.cssText = `
                    background: white;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    margin-top: 10px;
                    min-width: 200px;
                `;

                container.innerHTML = `
                    <div id="observedPositionHeader" style="padding: 8px 10px; background: white; border-radius: 4px 4px 0 0; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 16px;">⊗</span> Observed Position
                    </div>
                    <div id="observedPositionPanel" style="display: none; padding: 10px; padding-top: 5px;">
                        <div style="margin-bottom: 10px;">
                            <button id="observedPositionToggle" style="
                                width: 100%; padding: 8px; background: #4CAF50; color: white;
                                border: none; border-radius: 3px; cursor: pointer;
                                font-weight: bold; font-size: 12px;">
                                Start Marking
                            </button>
                        </div>
                        <div id="observedPositionStatus" style="text-align: center; font-size: 11px; color: #666; margin-bottom: 10px;">
                            Click button to start
                        </div>
                        <div style="border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;">
                            <div style="font-weight: bold; font-size: 11px; margin-bottom: 5px; color: #333;">
                                Marked Positions:
                            </div>
                            <div id="observedPositionList" style="max-height: 150px; overflow-y: auto;">
                                <div style="color: #999; font-style: italic; font-size: 11px;">No positions marked</div>
                            </div>
                        </div>
                        <div style="margin-top: 10px;">
                            <button id="clearAllPositions" style="
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

        new L.Control.ObservedPosition().addTo(map);

        // Setup event handlers after DOM is ready
        setTimeout(() => {
            const header = document.getElementById('observedPositionHeader');
            const panel = document.getElementById('observedPositionPanel');
            const toggleBtn = document.getElementById('observedPositionToggle');
            const clearBtn = document.getElementById('clearAllPositions');

            // Toggle panel visibility
            if (header && panel) {
                header.onclick = function(e) {
                    e.stopPropagation();
                    const isVisible = panel.style.display !== 'none';
                    panel.style.display = isVisible ? 'none' : 'block';
                    header.style.background = isVisible ? 'white' : '#ffebee';

                    // Disable placing mode when closing panel
                    if (isVisible && isPlacingMode) {
                        togglePlacingMode(false);
                    }
                };
            }

            // Toggle placing mode
            if (toggleBtn) {
                toggleBtn.onclick = function(e) {
                    e.stopPropagation();
                    togglePlacingMode(!isPlacingMode);
                };
            }

            // Clear all positions
            if (clearBtn) {
                clearBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (confirm('Clear all observed positions?')) {
                        clearAllPositions();
                    }
                };
            }
        }, 100);
    }

    /**
     * Initialize the Observed Position tool
     */
    window.initObservedPosition = function(leafletMap) {
        map = leafletMap;
        observedPositionLayer = L.layerGroup().addTo(map);

        createControlPanel();

        // Add map click listener
        map.on('click', onMapClick);

        console.log('✓ Observed Position tool initialized');
    };

})();