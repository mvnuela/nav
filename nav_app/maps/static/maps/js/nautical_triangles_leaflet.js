/**
 * Nautical Triangles for Leaflet Interactive Map
 * Adapts the canvas-based nautical triangles to work with Leaflet maps
 */

(function() {
    'use strict';

    let map = null;
    let triangleCanvas = null;
    let triangleManager = null;
    let trianglesVisible = false;
    let mapInteractionsState = null; // Store original map interaction states

    /**
     * Initialize nautical triangles on the Leaflet map
     * @param {L.Map} leafletMap - The Leaflet map instance
     */
    window.initNauticalTriangles = function(leafletMap) {
        map = leafletMap;
        
        // Create canvas overlay pane
        map.createPane('trianglesPane');
        map.getPane('trianglesPane').style.zIndex = 650; // Above markers (400), below popups (700)
        map.getPane('trianglesPane').style.pointerEvents = 'none'; // Let events pass through to canvas
        
        // Create canvas layer
        const CanvasLayer = L.Layer.extend({
            onAdd: function(map) {
                const size = map.getSize();
                triangleCanvas = L.DomUtil.create('canvas', 'triangle-overlay');
                triangleCanvas.width = size.x;
                triangleCanvas.height = size.y;
                triangleCanvas.style.position = 'absolute';
                triangleCanvas.style.left = '0px';
                triangleCanvas.style.top = '0px';
                triangleCanvas.style.pointerEvents = 'auto'; // Enable mouse events on canvas
                
                map.getPane('trianglesPane').appendChild(triangleCanvas);
                
                // Initialize triangle manager
                triangleManager = new NauticalTriangleManager();
                const triangleSize = Math.min(size.x, size.y) * 0.25;
                triangleManager.createStandardPair(size.x, size.y, triangleSize);
                
                // Setup mouse event handlers
                setupMouseHandlers();
                
                // Initial render
                renderTriangles();
                
                // Update on map resize
                map.on('resize', this._onResize, this);
            },
            
            onRemove: function(map) {
                if (triangleCanvas) {
                    L.DomUtil.remove(triangleCanvas);
                    triangleCanvas = null;
                }
                map.off('resize', this._onResize, this);
            },
            
            _onResize: function() {
                if (triangleCanvas) {
                    const size = map.getSize();
                    triangleCanvas.width = size.x;
                    triangleCanvas.height = size.y;
                    
                    // Adjust triangle positions to stay within bounds
                    if (triangleManager) {
                        triangleManager.triangles.forEach(triangle => {
                            triangle.x = Math.min(triangle.x, size.x - 50);
                            triangle.y = Math.min(triangle.y, size.y - 50);
                        });
                    }
                    
                    renderTriangles();
                }
            }
        });
        
        // Store canvas layer reference
        window.triangleCanvasLayer = new CanvasLayer();
        
        // Create custom control
        createTriangleControl(map);
        
        console.log('✓ Nautical triangles initialized');
    };
    
    /**
     * Create control panel for triangles
     */
    function createTriangleControl(map) {
        L.Control.NauticalTriangles = L.Control.extend({
            options: {
                position: 'topright'
            },
            
            onAdd: function() {
                const container = L.DomUtil.create('div', 'triangle-control');
                container.style.background = 'white';
                container.style.padding = '10px';
                container.style.border = '2px solid rgba(0,0,0,0.2)';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                container.style.marginTop = '10px';
                container.style.minWidth = '200px';
                
                container.innerHTML = `
                    <div style="margin-bottom: 8px;">
                        <strong>📐 Navigation Triangles</strong>
                    </div>
                    <button id="toggleTrianglesBtn" 
                            style="width:100%; padding:6px; margin-bottom:5px; cursor:pointer; background:#0078A8; color:white; border:none; border-radius:3px; font-weight:bold; font-size:11px;">
                        Show Triangles
                    </button>
                    <div id="triangleInfo" style="display:none; background:#e3f2fd; border:1px solid #0078A8; border-radius:3px; padding:8px; margin-top:8px; font-size:10px;">
                        <strong>Instructions:</strong>
                        <ul style="margin:4px 0 0 16px; padding:0;">
                            <li>Drag triangle body to move</li>
                            <li>Drag center point to rotate</li>
                            <li>Index line shows current bearing</li>
                            <li>Degree scale: 0°-180° on hypotenuse</li>
                        </ul>
                    </div>
                    <div id="triangleAngles" style="display:none; background:#fff; border:1px solid #ddd; border-radius:3px; padding:8px; margin-top:8px; font-family:monospace; font-size:10px;">
                        <strong>Current Angles:</strong>
                        <div id="portAngleLeaflet" style="margin-top:3px;">Port: 0°</div>
                        <div id="starboardAngleLeaflet" style="margin-top:3px;">Starboard: 0°</div>
                    </div>
                `;
                
                L.DomEvent.disableClickPropagation(container);
                
                // Setup button click handler
                setTimeout(() => {
                    const toggleBtn = document.getElementById('toggleTrianglesBtn');
                    if (toggleBtn) {
                        toggleBtn.onclick = toggleTriangles;
                    }
                }, 100);
                
                return container;
            }
        });
        
        // Add control to map
        new L.Control.NauticalTriangles().addTo(map);
    }
    
    /**
     * Setup mouse event handlers on canvas
     */
    function setupMouseHandlers() {
        if (!triangleCanvas) return;
        
        triangleCanvas.addEventListener('mousedown', function(e) {
            if (!trianglesVisible || !triangleManager) return;
            
            const rect = triangleCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const handled = triangleManager.handleMouseDown(x, y);
            if (handled) {
                // Disable map interactions while dragging/rotating triangle
                disableMapInteractions();
                renderTriangles();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        triangleCanvas.addEventListener('mousemove', function(e) {
            if (!trianglesVisible || !triangleManager) return;
            
            const rect = triangleCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const handled = triangleManager.handleMouseMove(x, y);
            const cursor = triangleManager.updateCursor(x, y);
            triangleCanvas.style.cursor = cursor;
            
            if (handled) {
                renderTriangles();
                updateTriangleAngles();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        triangleCanvas.addEventListener('mouseup', function(e) {
            if (!trianglesVisible || !triangleManager) return;
            
            const handled = triangleManager.handleMouseUp();
            if (handled) {
                // Re-enable map interactions after triangle operation
                enableMapInteractions();
                renderTriangles();
                updateTriangleAngles();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        triangleCanvas.addEventListener('mouseleave', function(e) {
            if (!trianglesVisible || !triangleManager) return;
            triangleManager.handleMouseUp();
            enableMapInteractions();
            renderTriangles();
        });
        
        // Add touch event handlers for mobile support
        triangleCanvas.addEventListener('touchstart', function(e) {
            if (!trianglesVisible || !triangleManager) return;
            
            const rect = triangleCanvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            const handled = triangleManager.handleMouseDown(x, y);
            if (handled) {
                disableMapInteractions();
                renderTriangles();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        triangleCanvas.addEventListener('touchmove', function(e) {
            if (!trianglesVisible || !triangleManager) return;
            
            const rect = triangleCanvas.getBoundingClientRect();
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            const handled = triangleManager.handleMouseMove(x, y);
            if (handled) {
                renderTriangles();
                updateTriangleAngles();
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        triangleCanvas.addEventListener('touchend', function(e) {
            if (!trianglesVisible || !triangleManager) return;
            
            const handled = triangleManager.handleMouseUp();
            if (handled) {
                enableMapInteractions();
                renderTriangles();
                updateTriangleAngles();
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }
    
    /**
     * Render triangles on canvas
     */
    function renderTriangles() {
        if (!triangleCanvas || !triangleManager) return;
        
        const ctx = triangleCanvas.getContext('2d');
        ctx.clearRect(0, 0, triangleCanvas.width, triangleCanvas.height);
        
        if (trianglesVisible) {
            triangleManager.drawAll(ctx);
        }
    }
    
    /**
     * Disable all Leaflet map interactions
     */
    function disableMapInteractions() {
        if (!map) return;
        
        // Store current state before disabling
        if (!mapInteractionsState) {
            mapInteractionsState = {
                dragging: map.dragging.enabled(),
                touchZoom: map.touchZoom.enabled(),
                doubleClickZoom: map.doubleClickZoom.enabled(),
                scrollWheelZoom: map.scrollWheelZoom.enabled(),
                boxZoom: map.boxZoom.enabled(),
                keyboard: map.keyboard.enabled()
            };
        }
        
        // Disable all interactions
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
    }
    
    /**
     * Restore Leaflet map interactions to previous state
     */
    function enableMapInteractions() {
        if (!map || !mapInteractionsState) return;
        
        // Restore to previous state
        if (mapInteractionsState.dragging) map.dragging.enable();
        if (mapInteractionsState.touchZoom) map.touchZoom.enable();
        if (mapInteractionsState.doubleClickZoom) map.doubleClickZoom.enable();
        if (mapInteractionsState.scrollWheelZoom) map.scrollWheelZoom.enable();
        if (mapInteractionsState.boxZoom) map.boxZoom.enable();
        if (mapInteractionsState.keyboard) map.keyboard.enable();
    }
    
    /**
     * Toggle triangle visibility
     */
    function toggleTriangles() {
        trianglesVisible = !trianglesVisible;
        
        const btn = document.getElementById('toggleTrianglesBtn');
        const info = document.getElementById('triangleInfo');
        const angles = document.getElementById('triangleAngles');
        
        if (trianglesVisible) {
            // Show triangles
            if (window.triangleCanvasLayer && map) {
                window.triangleCanvasLayer.addTo(map);
            }
            
            btn.textContent = 'Hide Triangles';
            btn.style.background = '#dc3545';
            info.style.display = 'block';
            angles.style.display = 'block';
            
            renderTriangles();
            updateTriangleAngles();
        } else {
            // Hide triangles
            if (window.triangleCanvasLayer && map) {
                map.removeLayer(window.triangleCanvasLayer);
            }
            
            // Ensure map interactions are enabled when hiding triangles
            enableMapInteractions();
            mapInteractionsState = null;
            
            btn.textContent = 'Show Triangles';
            btn.style.background = '#0078A8';
            info.style.display = 'none';
            angles.style.display = 'none';
            
            if (triangleCanvas) {
                const ctx = triangleCanvas.getContext('2d');
                ctx.clearRect(0, 0, triangleCanvas.width, triangleCanvas.height);
            }
        }
    }
    
    /**
     * Update triangle angle display
     */
    function updateTriangleAngles() {
        if (!triangleManager) return;
        
        const angles = triangleManager.getRotationAngles();
        const portElem = document.getElementById('portAngleLeaflet');
        const starboardElem = document.getElementById('starboardAngleLeaflet');
        
        if (portElem && angles.port !== undefined) {
            portElem.textContent = `Port: ${Math.round(angles.port)}°`;
        }
        if (starboardElem && angles.starboard !== undefined) {
            starboardElem.textContent = `Starboard: ${Math.round(angles.starboard)}°`;
        }
    }
    
    // Update angles periodically when visible
    setInterval(() => {
        if (trianglesVisible && triangleManager) {
            updateTriangleAngles();
        }
    }, 100);

})();