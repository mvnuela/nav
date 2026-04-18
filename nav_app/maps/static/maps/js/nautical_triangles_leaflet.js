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

    // Align-to-point mode state
    // 'idle'          — tool off, normal drag/rotate behavior
    // 'pick-triangle' — waiting for user to click a triangle
    // 'pick-point'    — waiting for user to click the target point
    let alignMode = 'idle';
    let alignTriangle = null;

    function setAlignMode(newMode) {
        const previous = alignMode;
        alignMode = newMode;

        const btn = document.getElementById('alignToPointBtn');
        const status = document.getElementById('alignStatus');

        // Leaving the mode — clear highlight and cursor
        if (newMode === 'idle') {
            if (alignTriangle && previous !== 'idle') {
                alignTriangle.setHighlight(false);
            }
            alignTriangle = null;
            document.body.style.cursor = '';
            if (btn) {
                btn.textContent = '📍 Align to Point';
                btn.style.background = '#00838F';
            }
            if (status) status.style.display = 'none';
            return;
        }

        // Entering/continuing an align step
        document.body.style.cursor = 'crosshair';
        if (btn) {
            btn.textContent = 'Cancel Align';
            btn.style.background = '#dc3545';
        }
        if (status) {
            status.style.display = 'block';
            status.textContent = newMode === 'pick-triangle'
                ? 'Align: click a triangle… (Esc to cancel)'
                : 'Align: click the target point on the map… (Esc to cancel)';
        }
    }

    /**
     * Translate `tri` so that the midpoint of its hypotenuse lands exactly
     * on the selected point (given in window client coords). Rotation is
     * preserved because the pivot equals the hypotenuse midpoint.
     *
     * `tri.x / tri.y` live in the triangle container's local coordinate space
     * (same system as `style.left / style.top`), not in client space. So we
     * convert the click's client coords using the container's bounding rect
     * before computing the translation delta.
     */
    function alignTriangleToPoint(tri, clientX, clientY) {
        const origin = (tri.svgElement && tri.svgElement.offsetParent)
            || triangleContainer
            || map.getContainer();
        const rect = origin.getBoundingClientRect();
        const targetX = clientX - rect.left;
        const targetY = clientY - rect.top;

        const halfHyp = tri.s(tri.config.hypotenuseLength) / 2;
        // Current hypotenuse midpoint in the same local coord system
        const mx = tri.x;
        const my = tri.y - halfHyp;

        tri.setPosition(tri.x + (targetX - mx), tri.y + (targetY - my));
    }

    // Capture-phase click listener so normal drag/rotate never starts while
    // the align tool is armed. Also blocks the map from reacting to the click.
    document.addEventListener('mousedown', function(e) {
        if (alignMode === 'idle') return;
        // Let clicks on any Leaflet control (including our panel) pass through
        // unmolested so Cancel/close still work.
        if (e.target.closest && e.target.closest('.leaflet-control')) return;
        if (!triangleManager) return;

        if (alignMode === 'pick-triangle') {
            for (const tri of triangleManager.triangles.values()) {
                if (tri.containsPoint(e.clientX, e.clientY)) {
                    alignTriangle = tri;
                    tri.setHighlight(true);
                    setAlignMode('pick-point');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return;
                }
            }
            // Clicked empty space — stay armed, swallow event
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
        }

        if (alignMode === 'pick-point') {
            if (alignTriangle) {
                alignTriangleToPoint(alignTriangle, e.clientX, e.clientY);
            }
            setAlignMode('idle');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, true);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && alignMode !== 'idle') {
            setAlignMode('idle');
        }
    });

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

        // Disable Leaflet keyboard when a triangle is selected so arrow keys
        // move the triangle instead of panning the map
        triangleManager.onSelectionChange = (triangle) => {
            if (triangle) {
                map.keyboard.disable();
            } else if (!window.mapInteractionLocked) {
                // Only re-enable if the global map lock is not active
                map.keyboard.enable();
            }
        };

        // Deselect triangle when user clicks outside any triangle
        document.addEventListener('mousedown', (e) => {
            if (!triangleManager.selectedTriangle) return;
            const clickedInsideTriangle = e.target.closest?.('.plotting-triangle');
            if (!clickedInsideTriangle) {
                triangleManager.selectedTriangle = null;
                triangleManager.onSelectionChange(null);
            }
        }, true);

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
                                <li>Drag to move triangle</li>
                                <li><strong>Ctrl + drag</strong> to rotate</li>
                                <li>Touch: 2 fingers to rotate</li>
                                <li>Scales: 0°-180° (outer), 180°-360° (inner)</li>
                                <li><strong>Align:</strong> dedicated tool below —<br>click a triangle, then a target point.<br>The hypotenuse midpoint snaps to that point without changing rotation.</li>
                            </ul>
                        </div>

                        <button id="alignToPointBtn" style="display: none; width: 100%; padding: 8px 12px; margin-top: 10px; cursor: pointer; background: #00838F; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 12px;">
                            📍 Align to Point
                        </button>
                        <div id="alignStatus" style="display: none; margin-top: 8px; padding: 8px; background: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; font-size: 11px; color: #856404; text-align: center;"></div>

                        <div id="triangleAnglesPanel" style="display: none; background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-top: 10px;">
                            <strong style="font-size: 11px; color: #666;">Current Rotations:</strong>
                            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="font-size: 11px; font-weight: bold; min-width: 70px;">Triangle A:</label>
                                    <input type="number" id="triangleAAngle" min="0" max="360" step="0.5" value="0"
                                        style="width: 60px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-family: monospace; font-size: 11px;">
                                    <span style="font-size: 11px;">°</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <label style="font-size: 11px; font-weight: bold; min-width: 70px;">Triangle B:</label>
                                    <input type="number" id="triangleBAngle" min="0" max="360" step="0.5" value="0"
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

        // Align-to-point tool
        const alignBtn = document.getElementById('alignToPointBtn');
        if (alignBtn) {
            alignBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (!trianglesVisible) return;
                if (alignMode === 'idle') {
                    setAlignMode('pick-triangle');
                } else {
                    setAlignMode('idle');
                }
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

        // Scale slider - recreates triangles with new size while preserving
        // their on-screen pivot (hypotenuse midpoint) so they stay put
        if (scaleSlider && scaleValue) {
            scaleSlider.addEventListener('input', function() {
                const scale = parseFloat(this.value);
                scaleValue.textContent = Math.round(scale * 100) + '%';

                if (triangleManager && trianglesVisible) {
                    // Base hypotenuse/2 from PlottingTriangle config — scaled height
                    const BASE_HEIGHT = 170;
                    const newHeight = BASE_HEIGHT * scale;

                    // Snapshot current pivot (x, y - scaled height) so it stays fixed
                    const triangleA = triangleManager.getTriangle('triangleA');
                    const triangleB = triangleManager.getTriangle('triangleB');

                    const stateA = triangleA
                        ? {
                            pivotX: triangleA.x,
                            pivotY: triangleA.y - BASE_HEIGHT * triangleA.scale,
                            rotation: triangleA.rotation
                        }
                        : null;
                    const stateB = triangleB
                        ? {
                            pivotX: triangleB.x,
                            pivotY: triangleB.y - BASE_HEIGHT * triangleB.scale,
                            rotation: triangleB.rotation
                        }
                        : null;

                    triangleManager.removeAll();

                    const size = map.getSize();

                    if (stateA) {
                        const newA = triangleManager.createTriangle(
                            'triangleA', 'Triangle A',
                            stateA.pivotX, stateA.pivotY + newHeight, scale
                        );
                        newA.setRotation(stateA.rotation);
                    } else {
                        triangleManager.createTriangle('triangleA', 'Triangle A', size.x * 0.35, size.y * 0.55, scale);
                    }

                    if (stateB) {
                        const newB = triangleManager.createTriangle(
                            'triangleB', 'Triangle B',
                            stateB.pivotX, stateB.pivotY + newHeight, scale
                        );
                        newB.setRotation(stateB.rotation);
                    } else {
                        triangleManager.createTriangle('triangleB', 'Triangle B', size.x * 0.65, size.y * 0.55, scale);
                    }

                    updateAngleDisplay(triangleManager.getRotationAngles());
                }
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
            const alignBtn = document.getElementById('alignToPointBtn');
            if (alignBtn) alignBtn.style.display = 'block';

            updateAngleDisplay(triangleManager.getRotationAngles());

        } else {
            // Hide triangles
            triangleManager.hideAll();
            triangleContainer.style.pointerEvents = 'none';
            setAlignMode('idle');
            const alignBtn = document.getElementById('alignToPointBtn');
            if (alignBtn) alignBtn.style.display = 'none';
            const alignStatus = document.getElementById('alignStatus');
            if (alignStatus) alignStatus.style.display = 'none';

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

        // Get scale from slider if it exists, otherwise use default
        const scaleSlider = document.getElementById('triangleScaleSlider');
        const scale = scaleSlider ? parseFloat(scaleSlider.value) : 1.0;

        // Create Triangle A (left side)
        triangleManager.createTriangle(
            'triangleA',
            'Triangle A',
            size.x * 0.35,
            size.y * 0.55,
            scale
        );

        // Create Triangle B (right side)
        triangleManager.createTriangle(
            'triangleB',
            'Triangle B',
            size.x * 0.65,
            size.y * 0.55,
            scale
        );
    }

    /**
     * Round to the nearest half-degree and drop the trailing ".0" when the
     * result happens to be a whole number, so "45°" stays "45" but a rotation
     * of 12.5° shows as "12.5".
     */
    function formatAngleDegrees(a) {
        const snapped = Math.round(a * 2) / 2;
        return snapped % 1 === 0 ? snapped.toFixed(0) : snapped.toFixed(1);
    }

    /**
     * Update the angle display in the control panel
     */
    function updateAngleDisplay(angles) {
        const triangleAInput = document.getElementById('triangleAAngle');
        const triangleBInput = document.getElementById('triangleBAngle');

        if (triangleAInput && angles.triangleA !== undefined) {
            triangleAInput.value = formatAngleDegrees(angles.triangleA);
        }
        if (triangleBInput && angles.triangleB !== undefined) {
            triangleBInput.value = formatAngleDegrees(angles.triangleB);
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