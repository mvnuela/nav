/**
 * Maritime Navigation Objects Module
 * Manages buoys, lighthouses, and other important sea markers
 */

(function() {
    'use strict';

    let map = null;
    let maritimeLayer = null;
    let maritimeObjects = [];
    let objectIdCounter = 0;
    let addObjectMode = false;
    let currentObjectType = 'buoy-green';

    // Maritime object types with icons and descriptions
    const OBJECT_TYPES = {
        'buoy-green': { name: 'Green Buoy', icon: '🟢', color: '#00b300', description: 'Starboard marker' },
        'buoy-red': { name: 'Red Buoy', icon: '🔴', color: '#ff0000', description: 'Port marker' },
        'buoy-yellow': { name: 'Yellow Buoy', icon: '🟡', color: '#ffd700', description: 'Special mark' },
        'buoy-cardinal-n': { name: 'North Cardinal', icon: '⬆️', color: '#000000', description: 'Pass north of danger' },
        'buoy-cardinal-s': { name: 'South Cardinal', icon: '⬇️', color: '#000000', description: 'Pass south of danger' },
        'buoy-cardinal-e': { name: 'East Cardinal', icon: '➡️', color: '#000000', description: 'Pass east of danger' },
        'buoy-cardinal-w': { name: 'West Cardinal', icon: '⬅️', color: '#000000', description: 'Pass west of danger' },
        'lighthouse': { name: 'Lighthouse', icon: '🗼', color: '#ffa500', description: 'Fixed light' },
        'light-buoy': { name: 'Light Buoy', icon: '💡', color: '#ffff00', description: 'Lighted marker' },
        'beacon': { name: 'Beacon', icon: '📍', color: '#ff69b4', description: 'Fixed beacon' },
        'anchor': { name: 'Anchorage', icon: '⚓', color: '#4169e1', description: 'Anchoring area' },
        'danger': { name: 'Danger Area', icon: '⚠️', color: '#ff4500', description: 'Hazardous area' },
        'wreck': { name: 'Wreck', icon: '🚢', color: '#8b0000', description: 'Shipwreck' },
        'rock': { name: 'Rock/Shoal', icon: '🪨', color: '#696969', description: 'Underwater hazard' }
    };

    /**
     * Initialize maritime objects system
     */
    function initMaritimeObjects(leafletMap) {
        map = leafletMap;
        maritimeLayer = L.layerGroup().addTo(map);

        // Add control panel
        addMaritimeControl();

        // Map click handler for adding objects
        map.on('click', handleMapClick);

        console.log('✓ Maritime objects initialized');
    }

    /**
     * Handle map click to add maritime object
     */
    function handleMapClick(e) {
        if (!addObjectMode) return;

        const lat = e.latlng.lat;
        const lon = e.latlng.lng;

        promptForObjectDetails(lat, lon);
    }

    /**
     * Prompt for object details
     */
    function promptForObjectDetails(lat, lon) {
        const name = prompt(
            `Add ${OBJECT_TYPES[currentObjectType].name}\n\nEnter a name or identifier:`,
            `${OBJECT_TYPES[currentObjectType].name} ${objectIdCounter + 1}`
        );

        if (!name) {
            return;
        }

        const notes = prompt(
            'Enter additional notes (optional):',
            ''
        );

        addMaritimeObject(lat, lon, currentObjectType, name, notes || '');
    }

    /**
     * Add a maritime object to the map
     */
    function addMaritimeObject(lat, lon, type, name, notes) {
        const id = objectIdCounter++;

        const object = {
            id: id,
            lat: lat,
            lon: lon,
            type: type,
            name: name,
            notes: notes,
            marker: null
        };

        // Create marker
        const typeInfo = OBJECT_TYPES[type];
        const marker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'maritime-marker',
                html: `
                    <div style="
                        font-size: 24px; 
                        text-align: center;
                        filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.5));
                        cursor: pointer;
                    ">${typeInfo.icon}</div>
                `,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            }),
            title: name
        });

        // Add popup
        const popupContent = `
            <div style="min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; color: ${typeInfo.color}; font-size: 1.1em;">
                    ${typeInfo.icon} ${name}
                </h3>
                <div style="font-size: 0.9em; margin-bottom: 8px;">
                    <strong>Type:</strong> ${typeInfo.name}<br>
                    <strong>Position:</strong><br>
                    ${decimalToNautical(lat, true)}<br>
                    ${decimalToNautical(lon, false)}
                </div>
                ${notes ? `<div style="font-size: 0.85em; margin-bottom: 8px; padding: 6px; background: #f0f0f0; border-radius: 3px;"><strong>Notes:</strong><br>${notes}</div>` : ''}
                <div style="font-size: 0.8em; color: #666; margin-bottom: 8px;">
                    ${typeInfo.description}
                </div>
                <button onclick="window.deleteMaritimeObject(${id})" 
                        style="width: 100%; padding: 6px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
                    🗑️ Delete
                </button>
            </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(maritimeLayer);

        object.marker = marker;
        maritimeObjects.push(object);

        updateObjectsList();

        console.log('Maritime object added:', object);
    }

    /**
     * Delete a maritime object
     */
    function deleteMaritimeObject(id) {
        const object = maritimeObjects.find(o => o.id === id);
        if (!object) return;

        if (confirm(`Delete ${object.name}?`)) {
            maritimeLayer.removeLayer(object.marker);
            maritimeObjects = maritimeObjects.filter(o => o.id !== id);
            updateObjectsList();

            console.log('Maritime object deleted:', id);
        }
    }

    /**
     * Add maritime control panel
     */
    function addMaritimeControl() {
        const MaritimeControl = L.Control.extend({
            options: { position: 'topleft' },

            onAdd: function() {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control maritime-control');
                container.style.background = 'white';
                container.style.padding = '12px';
                container.style.maxWidth = '280px';
                container.style.maxHeight = '400px';
                container.style.overflowY = 'auto';

                container.innerHTML = `
                    <div style="margin-bottom: 12px;">
                        <h3 style="margin: 0 0 10px 0; color: #0078A8; font-size: 1.1em; border-bottom: 2px solid #0078A8; padding-bottom: 5px;">
                            ⚓ Maritime Objects
                        </h3>
                        
                        <button id="toggleAddMode" style="
                            width: 100%; 
                            padding: 8px; 
                            background: #6c757d; 
                            color: white; 
                            border: none; 
                            border-radius: 4px; 
                            cursor: pointer; 
                            font-weight: bold;
                            margin-bottom: 10px;
                        ">
                            📍 Add Object Mode: OFF
                        </button>

                        <div style="margin-bottom: 10px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 600; font-size: 0.9em;">Select Type:</label>
                            <select id="objectTypeSelect" style="
                                width: 100%; 
                                padding: 6px; 
                                border: 1px solid #ddd; 
                                border-radius: 4px;
                                font-size: 0.9em;
                            ">
                                <optgroup label="Lateral Buoys">
                                    <option value="buoy-green">🟢 Green Buoy (Starboard)</option>
                                    <option value="buoy-red">🔴 Red Buoy (Port)</option>
                                </optgroup>
                                <optgroup label="Cardinal Buoys">
                                    <option value="buoy-cardinal-n">⬆️ North Cardinal</option>
                                    <option value="buoy-cardinal-s">⬇️ South Cardinal</option>
                                    <option value="buoy-cardinal-e">➡️ East Cardinal</option>
                                    <option value="buoy-cardinal-w">⬅️ West Cardinal</option>
                                </optgroup>
                                <optgroup label="Special Marks">
                                    <option value="buoy-yellow">🟡 Yellow Buoy (Special)</option>
                                    <option value="light-buoy">💡 Light Buoy</option>
                                </optgroup>
                                <optgroup label="Fixed Aids">
                                    <option value="lighthouse">🗼 Lighthouse</option>
                                    <option value="beacon">📍 Beacon</option>
                                </optgroup>
                                <optgroup label="Hazards & Areas">
                                    <option value="anchor">⚓ Anchorage</option>
                                    <option value="danger">⚠️ Danger Area</option>
                                    <option value="wreck">🚢 Wreck</option>
                                    <option value="rock">🪨 Rock/Shoal</option>
                                </optgroup>
                            </select>
                        </div>

                        <div id="maritimeObjectsList" style="font-size: 0.85em; max-height: 200px; overflow-y: auto; margin-top: 10px;"></div>
                    </div>
                `;

                L.DomEvent.disableClickPropagation(container);
                return container;
            }
        });

        map.addControl(new MaritimeControl());

        // Add event listeners after control is added
        setTimeout(() => {
            document.getElementById('toggleAddMode').addEventListener('click', toggleAddMode);
            document.getElementById('objectTypeSelect').addEventListener('change', function() {
                currentObjectType = this.value;
            });
            
            updateObjectsList();
        }, 100);
    }

    /**
     * Toggle add object mode
     */
    function toggleAddMode() {
        addObjectMode = !addObjectMode;
        const btn = document.getElementById('toggleAddMode');
        
        if (addObjectMode) {
            btn.style.background = '#28a745';
            btn.textContent = '✓ Add Object Mode: ON';
            map.getContainer().style.cursor = 'crosshair';
        } else {
            btn.style.background = '#6c757d';
            btn.textContent = '📍 Add Object Mode: OFF';
            map.getContainer().style.cursor = '';
        }
    }

    /**
     * Update objects list in control panel
     */
    function updateObjectsList() {
        const listEl = document.getElementById('maritimeObjectsList');
        if (!listEl) return;

        if (maritimeObjects.length === 0) {
            listEl.innerHTML = '<div style="color: #999; text-align: center; padding: 10px;">No objects added yet</div>';
            return;
        }

        listEl.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: 600; color: #0078A8;">
                Objects (${maritimeObjects.length}):
            </div>
        ` + maritimeObjects.map(obj => {
            const typeInfo = OBJECT_TYPES[obj.type];
            return `
                <div style="
                    background: #f8f9fa; 
                    padding: 8px; 
                    margin-bottom: 6px; 
                    border-radius: 4px; 
                    border-left: 3px solid ${typeInfo.color};
                    cursor: pointer;
                " onclick="window.focusMaritimeObject(${obj.id})">
                    <div style="font-weight: 600; margin-bottom: 3px;">
                        ${typeInfo.icon} ${obj.name}
                    </div>
                    <div style="font-size: 0.75em; color: #666;">
                        ${typeInfo.name}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Focus on a specific maritime object
     */
    function focusMaritimeObject(id) {
        const object = maritimeObjects.find(o => o.id === id);
        if (!object) return;

        map.setView([object.lat, object.lon], Math.max(map.getZoom(), 10));
        object.marker.openPopup();
    }

    /**
     * Clear all maritime objects
     */
    function clearAllMaritimeObjects() {
        if (maritimeObjects.length === 0) return;

        if (confirm(`Delete all ${maritimeObjects.length} maritime objects?`)) {
            maritimeLayer.clearLayers();
            maritimeObjects = [];
            objectIdCounter = 0;
            updateObjectsList();
            console.log('All maritime objects cleared');
        }
    }

    /**
     * Export maritime objects to JSON
     */
    function exportMaritimeObjects() {
        if (maritimeObjects.length === 0) {
            alert('No objects to export');
            return;
        }

        const exportData = maritimeObjects.map(obj => ({
            name: obj.name,
            type: obj.type,
            lat: obj.lat,
            lon: obj.lon,
            notes: obj.notes
        }));

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'maritime_objects.json';
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('Maritime objects exported');
    }

    /**
     * Import maritime objects from JSON
     */
    function importMaritimeObjects(jsonData) {
        try {
            const objects = JSON.parse(jsonData);
            
            objects.forEach(obj => {
                if (obj.lat && obj.lon && obj.type && OBJECT_TYPES[obj.type]) {
                    addMaritimeObject(obj.lat, obj.lon, obj.type, obj.name || 'Imported', obj.notes || '');
                }
            });

            alert(`Imported ${objects.length} maritime objects`);
        } catch (error) {
            alert('Error importing objects: ' + error.message);
            console.error('Import error:', error);
        }
    }

    // Expose functions to window
    window.initMaritimeObjects = initMaritimeObjects;
    window.deleteMaritimeObject = deleteMaritimeObject;
    window.focusMaritimeObject = focusMaritimeObject;
    window.clearAllMaritimeObjects = clearAllMaritimeObjects;
    window.exportMaritimeObjects = exportMaritimeObjects;
    window.importMaritimeObjects = importMaritimeObjects;

})();