/**
 * Nautical Plotting Triangles - Leaflet Integration
 * Integrates SVG-based plotting triangles with Leaflet maps
 *
 * Features:
 * - Two independent plotting triangles (A and B)
 * - Drag and rotate functionality
 * - Does not interfere with map interactions outside triangle areas
 * - Proper z-index management
 * - Responsive to map container resize
 */

(function() {
    'use strict';

    let map = null;
    let triangleContainer = null;
    let triangleManager = null;
    let trianglesVisible = false;
    let mapPane = null;

    // Store map interaction state
    let mapInteractionState = null;

    /**
     * Initialize nautical triangles on the Leaflet map
     * @param {L.Map} leafletMap - The Leaflet map instance
     */
    window.initNauticalTriangles = function(leafletMap) {
        map = leafletMap;

        // Create a custom pane for triangles
        if (!map.getPane('trianglesPane')) {
            mapPane = map.createPane('trianglesPane');
            mapPane.style.zIndex = 650; // Above markers, below popups
            mapPane.style.pointerEvents = 'none'; // Let events pass through by default
        } else {
            mapPane = map.getPane('trianglesPane');
        }

        // Create container div for triangle SVGs
        triangleContainer = L.DomUtil.create('div', 'triangle-container');
        triangleContainer.style.position = 'absolute';
        triangleContainer.style.left = '0';
        triangleContainer.style.top = '0';
        triangleContainer.style.width = '100%';
        triangleContainer.style.height = '100%';
        triangleContainer.style.pointerEvents = 'none'; // Container doesn't capture events
        triangleContainer.style.overflow = 'visible';

        mapPane.appendChild(triangleContainer);

        // Initialize triangle manager
        triangleManager = new PlottingTriangleManager();
        triangleManager.setContainer(triangleContainer);

        // Set up change callback for angle display updates
        triangleManager.onChange(updateAngleDisplay);

        // Create the control panel
        createTriangleControl(map);

        // Handle map resize
        map.on('resize', handleMapResize);

        // Handle map move/zoom (triangles stay fixed in screen space)
        map.on('move', handleMapMove);

        console.log('Plotting triangles initialized');
    };

    /**
     * Create the control panel for triangles
     */
    function createTriangleControl(map) {
        const TriangleControl = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: function() {
                const container = L.DomUtil.create('div', 'leaflet-control triangle-control');
                container.style.background = 'white';
                container.style.border = '2px solid rgba(0,0,0,0.2)';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                container.style.marginTop = '10px';

                container.innerHTML = `
                    <div id="trianglesPanelToggle" style="padding: 8px 12px; background: white; border-radius: 4px; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 14px;">&#x25B3;</span>
                        <span>Plotting Triangles</span>
                    </div>
                    <div id="trianglesPanelContent" style="display: none; padding: 12px; min-width: 220px; border-top: 1px solid #ddd;">
                        <button id="toggleTrianglesBtn"
                            style="width: 100%; padding: 8px 12px; cursor: pointer; background: #0078A8; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 12px; transition: background 0.2s;">
                            Show Triangles
                        </button>

                        <div id="triangleInstructions" style="display: none; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 4px; padding: 10px; margin-top: 10px; font-size: 11px;">
                            <strong style="color: #1565c0;">Instructions:</strong>
                            <ul style="margin: 6px 0 0 16px; padding: 0; color: #424242;">
                                <li>Drag triangle body to move</li>
                                <li>Drag center point (red) to rotate</li>
                                <li>Scales: 0°-180° (outer), 180°-360° (inner)</li>
                                <li>Red lines: main directions (0°-180°, 90°-270°)</li>
                                <li>Blue dashed: auxiliary (45°, 135°)</li>
                            </ul>
                        </div>

                        <div id="triangleAnglesPanel" style="display: none; background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-top: 10px;">
                            <strong style="font-size: 11px; color: #666;">Current Rotations:</strong>
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="font-size: 11px; font-weight: bold; min-width: 70px;">Triangle A:</label>
                                    <input type="number" id="triangleAAngle" min="0" max="360" value="0"
                                        style="width: 60px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-family: monospace; font-size: 11px;">
                                    <span style="font-size: 11px;">°</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="font-size: 11px; font-weight: bold; min-width: 70px;">Triangle B:</label>
                                    <input type="number" id="triangleBAngle" min="0" max="360" value="0"
                                        style="width: 60px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-family: monospace; font-size: 11px;">
                                    <span style="font-size: 11px;">°</span>
                                </div>
                            </div>

                            <div style="display: flex; gap: 6px; margin-top: 10px;">
                                <button id="resetTriangleA" style="flex: 1; padding: 6px; font-size: 10px; cursor: pointer; background: #f5f5f5; border: 1px solid #ddd; border-radius: 3px;">
                                    Reset A
                                </button>
                                <button id="resetTriangleB" style="flex: 1; padding: 6px; font-size: 10px; cursor: pointer; background: #f5f5f5; border: 1px solid #ddd; border-radius: 3px;">
                                    Reset B
                                </button>
                                <button id="resetBothTriangles" style="flex: 1; padding: 6px; font-size: 10px; cursor: pointer; background: #f5f5f5; border: 1px solid #ddd; border-radius: 3px;">
                                    Reset Both
                                </button>
                            </div>
                        </div>

                        <div id="triangleScaleControl" style="display: none; margin-top: 10px; padding: 10px; background: #fafafa; border: 1px solid #ddd; border-radius: 4px;">
                            <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 6px;">
                                Triangle Size:
                            </label>
                            <input type="range" id="triangleScaleSlider" min="0.5" max="1.5" step="0.1" value="1.0"
                                style="width: 100%;">
                            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 2px;">
                                <span>Small</span>
                                <span id="scaleValue">100%</span>
                                <span>Large</span>
                            </div>
                        </div>
                    </div>
                `;

                // Prevent map interactions when clicking on control
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                // Setup event handlers after DOM is ready
                setTimeout(() => setupControlEventHandlers(), 50);

                return container;
            }
        });

        new TriangleControl().addTo(map);
    }

    /**
     * Setup event handlers for control panel
     */
    function setupControlEventHandlers() {
        const panelToggle = document.getElementById('trianglesPanelToggle');
        const panelContent = document.getElementById('trianglesPanelContent');
        const toggleBtn = document.getElementById('toggleTrianglesBtn');
        const instructions = document.getElementById('triangleInstructions');
        const anglesPanel = document.getElementById('triangleAnglesPanel');
        const scaleControl = document.getElementById('triangleScaleControl');
        const triangleAInput = document.getElementById('triangleAAngle');
        const triangleBInput = document.getElementById('triangleBAngle');
        const resetA = document.getElementById('resetTriangleA');
        const resetB = document.getElementById('resetTriangleB');
        const resetBoth = document.getElementById('resetBothTriangles');
        const scaleSlider = document.getElementById('triangleScaleSlider');
        const scaleValue = document.getElementById('scaleValue');

        // Toggle panel visibility
        if (panelToggle && panelContent) {
            panelToggle.addEventListener('click', function(e) {
                e.stopPropagation();
                const isVisible = panelContent.style.display !== 'none';
                panelContent.style.display = isVisible ? 'none' : 'block';
                panelToggle.style.background = isVisible ? 'white' : '#e8f5e9';
            });
        }

        // Toggle triangles visibility
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                toggleTriangles();
            });
        }

        // Angle input handlers
        if (triangleAInput) {
            triangleAInput.addEventListener('change', function() {
                const angle = parseFloat(this.value) || 0;
                if (triangleManager) {
                    triangleManager.setTriangleRotation('triangleA', angle);
                }
            });
        }

        if (triangleBInput) {
            triangleBInput.addEventListener('change', function() {
                const angle = parseFloat(this.value) || 0;
                if (triangleManager) {
                    triangleManager.setTriangleRotation('triangleB', angle);
                }
            });
        }

        // Reset buttons
        if (resetA) {
            resetA.addEventListener('click', function() {
                if (triangleManager) {
                    triangleManager.setTriangleRotation('triangleA', 0);
                    if (triangleAInput) triangleAInput.value = '0';
                }
            });
        }

        if (resetB) {
            resetB.addEventListener('click', function() {
                if (triangleManager) {
                    triangleManager.setTriangleRotation('triangleB', 0);
                    if (triangleBInput) triangleBInput.value = '0';
                }
            });
        }

        if (resetBoth) {
            resetBoth.addEventListener('click', function() {
                if (triangleManager) {
                    triangleManager.setTriangleRotation('triangleA', 0);
                    triangleManager.setTriangleRotation('triangleB', 0);
                    if (triangleAInput) triangleAInput.value = '0';
                    if (triangleBInput) triangleBInput.value = '0';
                }
            });
        }

        // Scale slider
        if (scaleSlider && scaleValue) {
            scaleSlider.addEventListener('input', function() {
                const scale = parseFloat(this.value);
                scaleValue.textContent = Math.round(scale * 100) + '%';
                // Scale change would require recreating triangles
                // This is a placeholder for future enhancement
            });
        }
    }

    /**
     * Toggle triangle visibility
     */
    function toggleTriangles() {
        trianglesVisible = !trianglesVisible;

        const toggleBtn = document.getElementById('toggleTrianglesBtn');
        const instructions = document.getElementById('triangleInstructions');
        const anglesPanel = document.getElementById('triangleAnglesPanel');
        const scaleControl = document.getElementById('triangleScaleControl');

        if (trianglesVisible) {
            // Create triangles if they don't exist
            if (triangleManager.triangles.size === 0) {
                createTriangles();
            }

            // Show triangles
            triangleManager.showAll();
            triangleContainer.style.pointerEvents = 'auto';

            // Update UI
            if (toggleBtn) {
                toggleBtn.textContent = 'Hide Triangles';
                toggleBtn.style.background = '#dc3545';
            }
            if (instructions) instructions.style.display = 'block';
            if (anglesPanel) anglesPanel.style.display = 'block';
            if (scaleControl) scaleControl.style.display = 'block';

            updateAngleDisplay(triangleManager.getRotationAngles());

        } else {
            // Hide triangles
            triangleManager.hideAll();
            triangleContainer.style.pointerEvents = 'none';

            // Update UI
            if (toggleBtn) {
                toggleBtn.textContent = 'Show Triangles';
                toggleBtn.style.background = '#0078A8';
            }
            if (instructions) instructions.style.display = 'none';
            if (anglesPanel) anglesPanel.style.display = 'none';
            if (scaleControl) scaleControl.style.display = 'none';
        }
    }

    /**
     * Create the two plotting triangles
     */
    function createTriangles() {
        if (!map || !triangleManager) return;

        const size = map.getSize();
        const scale = Math.min(size.x, size.y) / 800; // Adjust scale based on map size

        // Create Triangle A (left side)
        triangleManager.createTriangle(
            'triangleA',
            'Triangle A',
            size.x * 0.35,
            size.y * 0.5,
            Math.max(0.6, Math.min(1.2, scale))
        );

        // Create Triangle B (right side)
        triangleManager.createTriangle(
            'triangleB',
            'Triangle B',
            size.x * 0.65,
            size.y * 0.5,
            Math.max(0.6, Math.min(1.2, scale))
        );
    }

    /**
     * Update the angle display in the control panel
     */
    function updateAngleDisplay(angles) {
        const triangleAInput = document.getElementById('triangleAAngle');
        const triangleBInput = document.getElementById('triangleBAngle');

        if (triangleAInput && angles.triangleA !== undefined) {
            triangleAInput.value = Math.round(angles.triangleA);
        }
        if (triangleBInput && angles.triangleB !== undefined) {
            triangleBInput.value = Math.round(angles.triangleB);
        }
    }

    /**
     * Handle map resize
     */
    function handleMapResize() {
        if (!triangleManager || !trianglesVisible) return;

        // Keep triangles within bounds after resize
        const size = map.getSize();

        for (const [id, triangle] of triangleManager.triangles) {
            // Clamp position to stay within map bounds
            const margin = 100;
            triangle.x = Math.max(margin, Math.min(size.x - margin, triangle.x));
            triangle.y = Math.max(margin, Math.min(size.y - margin, triangle.y));
            triangle.updatePosition();
        }
    }

    /**
     * Handle map move/zoom
     * Triangles stay fixed relative to screen, not map coordinates
     */
    function handleMapMove() {
        // Triangles are positioned in screen coordinates, so they stay fixed
        // This is the expected behavior for navigation instruments
    }

    /**
     * Get current triangle angles (for external use)
     */
    window.getTriangleAngles = function() {
        if (!triangleManager) return null;
        return triangleManager.getRotationAngles();
    };

    /**
     * Set triangle angle programmatically
     */
    window.setTriangleAngle = function(triangleId, angle) {
        if (!triangleManager) return;
        triangleManager.setTriangleRotation(triangleId, angle);
    };

    /**
     * Show/hide triangles programmatically
     */
    window.showTriangles = function(show = true) {
        if (show !== trianglesVisible) {
            toggleTriangles();
        }
    };

    /**
     * Check if triangles are currently visible
     */
    window.areTrianglesVisible = function() {
        return trianglesVisible;
    };

})();