/**
 * Enhanced Interactive Graticule System
 * Core class with event handling, zoom/pan, image loading, bounds management,
 * and render orchestration.
 *
 * Depends on: graticule_projection.js (MercatorProjection, MapRegion, CoordinateMapper)
 * Extended by: graticule_drawing.js (drawing/export) and graticule_tools.js (tool integration)
 */

class EnhancedGraticuleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.projection = new MercatorProjection();

        this.uploadedImage = null;
        this.mapRegion = null;
        this.geoBounds = null;
        this.mapper = null;

        this.mode = 'view'; // 'fit', 'view', or 'triangles'

        // Grid spacing configuration (in decimal degrees)
        this.latInterval = 0.5; // Parallel (latitude line) spacing - default 30 arcminutes
        this.lonInterval = 0.5; // Meridian (longitude line) spacing - default 30 arcminutes
        this.showMinorGrid = false;

        // Zoom and pan state
        this.zoom = 1.0;
        this.minZoom = 1.0;
        this.maxZoom = 10.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.lastPanX = 0;
        this.lastPanY = 0;

        // Nautical triangles
        this.triangleManager = null;
        this.trianglesVisible = false;

        // Nautical divider
        this.dividerManager = null;
        this.dividerVisible = false;

        // GPX routes
        this.gpxManager = null;
        this.gpxVisible = false;

        // Observed positions
        this.observedPositionManager = null;
        this.observedPositionVisible = false;

        // Geometry (points, connections, rays)
        this.geometryManager = null;
        this.geometryVisible = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        // Mouse wheel for zoom
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Touch events for pinch zoom
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Copy the cursor position with "C" while the pointer is over the map.
        // The listener sits on the document because the canvas is not
        // focusable, so it would never receive key events itself.
        this.pointerOverCanvas = false;
        this.canvas.addEventListener('mouseenter', () => { this.pointerOverCanvas = true; });
        this.canvas.addEventListener('mouseleave', () => { this.pointerOverCanvas = false; });
        document.addEventListener('keydown', (e) => this.handleCopyShortcut(e));

        // Track touch state for pinch zoom
        this.touches = [];
        this.initialPinchDistance = 0;
        this.initialZoom = 1;
    }

    // ——— Zoom & Pan ———

    handleWheel(e) {
        e.preventDefault();

        // Don't zoom when a triangle is selected (arrow keys control it instead).
        // Only applies while the triangles are actually on screen — a selection
        // left behind by a hidden triangle must not block zoom.
        if (this.trianglesVisible && this.triangleManager?.selectedTriangle) return;

        if (!this.uploadedImage) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

        if (newZoom !== this.zoom) {
            const zoomRatio = newZoom / this.zoom;

            this.panX = mouseX - (mouseX - this.panX) * zoomRatio;
            this.panY = mouseY - (mouseY - this.panY) * zoomRatio;

            this.zoom = newZoom;
            this.constrainPan();
            this.render();
            this.updateZoomDisplay();
        }
    }

    handleTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            this.touches = Array.from(e.touches);
            this.initialPinchDistance = this.getPinchDistance(e.touches);
            this.initialZoom = this.zoom;
            this.isPanning = false;
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.panStartX = touch.clientX;
            this.panStartY = touch.clientY;
            this.lastPanX = this.panX;
            this.lastPanY = this.panY;
        }
    }

    handleTouchMove(e) {
        if (e.touches.length === 2 && this.initialPinchDistance > 0) {
            e.preventDefault();
            const currentDistance = this.getPinchDistance(e.touches);
            const scale = currentDistance / this.initialPinchDistance;
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.initialZoom * scale));

            if (newZoom !== this.zoom) {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * scaleX;
                const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) * scaleY;

                const zoomRatio = newZoom / this.zoom;
                this.panX = centerX - (centerX - this.panX) * zoomRatio;
                this.panY = centerY - (centerY - this.panY) * zoomRatio;

                this.zoom = newZoom;
                this.constrainPan();
                this.render();
                this.updateZoomDisplay();
            }
        } else if (e.touches.length === 1 && this.zoom > 1) {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;

            const dx = (touch.clientX - this.panStartX) * scaleX;
            const dy = (touch.clientY - this.panStartY) * scaleY;

            this.panX = this.lastPanX + dx;
            this.panY = this.lastPanY + dy;
            this.constrainPan();
            this.render();
        }
    }

    handleTouchEnd(e) {
        if (e.touches.length < 2) {
            this.initialPinchDistance = 0;
            this.touches = [];
        }
    }

    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    constrainPan() {
        if (!this.uploadedImage) return;

        const scaledWidth = this.canvas.width * this.zoom;
        const scaledHeight = this.canvas.height * this.zoom;

        const margin = 50;

        const maxPanX = scaledWidth - this.canvas.width + margin;
        const maxPanY = scaledHeight - this.canvas.height + margin;

        this.panX = Math.max(-maxPanX, Math.min(margin, this.panX));
        this.panY = Math.max(-maxPanY, Math.min(margin, this.panY));
    }

    zoomIn() {
        const newZoom = Math.min(this.maxZoom, this.zoom * 1.25);
        if (newZoom !== this.zoom) {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const zoomRatio = newZoom / this.zoom;

            this.panX = centerX - (centerX - this.panX) * zoomRatio;
            this.panY = centerY - (centerY - this.panY) * zoomRatio;

            this.zoom = newZoom;
            this.constrainPan();
            this.render();
            this.updateZoomDisplay();
        }
    }

    zoomOut() {
        const newZoom = Math.max(1.0, this.zoom / 1.25);
        if (newZoom !== this.zoom) {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const zoomRatio = newZoom / this.zoom;

            this.panX = centerX - (centerX - this.panX) * zoomRatio;
            this.panY = centerY - (centerY - this.panY) * zoomRatio;

            this.zoom = newZoom;
            this.constrainPan();
            this.render();
            this.updateZoomDisplay();
        }
    }

    resetZoom() {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.render();
        this.updateZoomDisplay();
    }

    setZoom(level) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        if (newZoom !== this.zoom) {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const zoomRatio = newZoom / this.zoom;

            this.panX = centerX - (centerX - this.panX) * zoomRatio;
            this.panY = centerY - (centerY - this.panY) * zoomRatio;

            this.zoom = newZoom;
            this.constrainPan();
            this.render();
            this.updateZoomDisplay();
        }
    }

    getZoom() {
        return this.zoom;
    }

    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = Math.round(this.zoom * 100) + '%';
        }
    }

    screenToCanvas(screenX, screenY) {
        return {
            x: (screenX - this.panX) / this.zoom,
            y: (screenY - this.panY) / this.zoom
        };
    }

    canvasToScreen(canvasX, canvasY) {
        return {
            x: canvasX * this.zoom + this.panX,
            y: canvasY * this.zoom + this.panY
        };
    }

    // ——— Image Loading ———

    loadImage(imageSrc) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.uploadedImage = img;
                this.canvas.width = img.width;
                this.canvas.height = img.height;

                // Initialize default region (80% of image)
                const margin = 0.1;
                this.mapRegion = new MapRegion(
                    img.width * margin,
                    img.height * margin,
                    img.width * (1 - 2 * margin),
                    img.height * (1 - 2 * margin)
                );

                // Scale canvas to fit viewport
                this.fitToWindow();

                this.render();
                resolve(img);
            };
            img.onerror = reject;
            img.src = imageSrc;
        });
    }

    fitToWindow() {
        if (!this.uploadedImage) return;

        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth - 40; // padding
        const containerHeight = container.clientHeight - 40; // padding

        const imageWidth = this.uploadedImage.width;
        const imageHeight = this.uploadedImage.height;

        // Calculate scale to fit
        const scaleX = containerWidth / imageWidth;
        const scaleY = containerHeight / imageHeight;
        const scale = Math.min(scaleX, scaleY, 1.0); // Don't zoom in beyond 100%

        // Apply CSS scaling
        const newWidth = imageWidth * scale;
        const newHeight = imageHeight * scale;

        this.canvas.style.width = newWidth + 'px';
        this.canvas.style.height = newHeight + 'px';

        // Store scale factor for coordinate conversion
        this.displayScale = scale;
    }

    // ——— Geographic Bounds & Grid Configuration ———

    setGeographicBounds(minLat, maxLat, minLon, maxLon, grid = undefined) {
        const resolvedGrid = (grid && typeof grid === 'object')
            ? grid
            : { latInterval: this.latInterval, lonInterval: this.lonInterval };

        if (typeof resolvedGrid.latInterval === 'number' && typeof resolvedGrid.lonInterval === 'number') {
            this.setGridIntervals(resolvedGrid.latInterval, resolvedGrid.lonInterval);
        }

        this.geoBounds = { minLat, maxLat, minLon, maxLon };

        if (this.mapRegion) {
            this.mapper = new CoordinateMapper(
                this.mapRegion,
                this.geoBounds,
                this.projection
            );
        }

        this.render();
    }

    setGridIntervals(latInterval, lonInterval) {
        const validation = this.validateIntervals(latInterval, lonInterval);
        if (!validation.valid) {
            throw new Error('Invalid grid intervals: ' + validation.errors.join(', '));
        }

        this.latInterval = latInterval;
        this.lonInterval = lonInterval;

        console.log(`Grid intervals set - Parallels: ${this.formatIntervalDMS(latInterval)}, Meridians: ${this.formatIntervalDMS(lonInterval)}`);

        if (this.mapper) {
            this.render();
        }
    }

    getGridIntervals() {
        return {
            latInterval: this.latInterval,
            lonInterval: this.lonInterval
        };
    }

    getGridIntervalsFormatted() {
        return {
            parallels: this.formatIntervalDMS(this.latInterval),
            meridians: this.formatIntervalDMS(this.lonInterval)
        };
    }

    formatIntervalDMS(decimal) {
        if (decimal == null || isNaN(decimal)) return 'N/A';

        const degrees = Math.floor(decimal);
        const minutesDecimal = (decimal - degrees) * 60;
        const minutes = Math.floor(minutesDecimal);
        const seconds = ((minutesDecimal - minutes) * 60);

        if (degrees > 0 && minutes === 0 && Math.abs(seconds) < 0.1) {
            return `${degrees}°`;
        } else if (degrees === 0 && Math.abs(seconds) < 0.1) {
            return `${minutes}'`;
        } else if (degrees === 0) {
            return `${minutes}' ${seconds.toFixed(1)}"`;
        } else if (Math.abs(seconds) < 0.1) {
            return `${degrees}° ${minutes}'`;
        } else {
            return `${degrees}° ${minutes}' ${seconds.toFixed(1)}"`;
        }
    }

    setGridIntervalsFromDMS(parallels, meridians) {
        const latInterval = this.dmsToDecimal(
            parallels.degrees || 0,
            parallels.minutes || 0,
            parallels.seconds || 0
        );
        const lonInterval = this.dmsToDecimal(
            meridians.degrees || 0,
            meridians.minutes || 0,
            meridians.seconds || 0
        );

        this.setGridIntervals(latInterval, lonInterval);
    }

    dmsToDecimal(degrees, minutes, seconds) {
        degrees = parseFloat(degrees) || 0;
        minutes = parseFloat(minutes) || 0;
        seconds = parseFloat(seconds) || 0;
        return degrees + (minutes / 60) + (seconds / 3600);
    }

    applyGridPreset(presetName) {
        const presets = {
            fine: { latInterval: 1/60, lonInterval: 1/60 },
            standard: { latInterval: 0.5, lonInterval: 0.5 },
            coarse: { latInterval: 1, lonInterval: 1 },
            nautical: { latInterval: 1/60, lonInterval: 0.5 },
            veryFine: { latInterval: 30/3600, lonInterval: 30/3600 }
        };

        const preset = typeof presetName === 'string' ? presets[presetName] : presetName;

        if (preset && preset.latInterval && preset.lonInterval) {
            this.setGridIntervals(preset.latInterval, preset.lonInterval);
        } else {
            console.warn('Unknown or invalid preset:', presetName);
        }
    }

    validateIntervals(latInterval, lonInterval) {
        const errors = [];

        if (latInterval == null || isNaN(latInterval)) {
            errors.push('Latitude interval is not a valid number');
        } else if (latInterval <= 0) {
            errors.push('Latitude interval must be greater than 0');
        } else if (latInterval > 90) {
            errors.push('Latitude interval cannot exceed 90 degrees');
        }

        if (lonInterval == null || isNaN(lonInterval)) {
            errors.push('Longitude interval is not a valid number');
        } else if (lonInterval <= 0) {
            errors.push('Longitude interval must be greater than 0');
        } else if (lonInterval > 180) {
            errors.push('Longitude interval cannot exceed 180 degrees');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    setMode(mode) {
        this.mode = mode;
        this.render();
    }

    // ——— Mouse Event Handlers ———

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const screenX = (e.clientX - rect.left) * scaleX;
        const screenY = (e.clientY - rect.top) * scaleY;

        const canvasCoords = this.screenToCanvas(screenX, screenY);
        const x = canvasCoords.x;
        const y = canvasCoords.y;

        // Middle mouse button or Space+click for panning
        if (e.button === 1 || (e.button === 0 && e.shiftKey && this.zoom > 1)) {
            e.preventDefault();
            this.isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.lastPanX = this.panX;
            this.lastPanY = this.panY;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        // Handle geometry interactions when visible
        if (this.geometryVisible && this.geometryManager) {
            const handled = this.geometryManager.handleMouseDown(x, y);
            if (handled) {
                this.render();
                return;
            }
        }

        // Handle observed position interactions when visible
        if (this.observedPositionVisible && this.observedPositionManager) {
            const handled = this.observedPositionManager.handleMouseDown(x, y);
            if (handled) {
                this.render();
                return;
            }
        }

        // Handle divider interactions when dividers are visible
        if (this.dividerVisible && this.dividerManager) {
            const handled = this.dividerManager.handleMouseDown(x, y);
            if (handled) {
                this.render();
                return;
            }
        }

        // Handle triangle interactions when triangles are visible
        if (this.trianglesVisible && this.triangleManager) {
            const handled = this.triangleManager.handleMouseDown(x, y);
            if (handled) {
                this.render();
                return;
            }
            // Clicked away from every triangle — drop the selection, matching
            // the Leaflet map's behavior.
            if (this.triangleManager.deselect()) {
                this.render();
            }
        }

        // Handle region fitting in fit mode
        if (this.mode === 'fit' && this.mapRegion) {
            const handle = this.mapRegion.hitTest(x, y);
            if (handle && !(handle === 'center' && this.zoom > 1)) {
                this.mapRegion.isDragging = true;
                this.mapRegion.dragHandle = handle;
                this.mapRegion.dragStartX = x;
                this.mapRegion.dragStartY = y;
                this.dragStartRegion = {
                    x: this.mapRegion.x,
                    y: this.mapRegion.y,
                    width: this.mapRegion.width,
                    height: this.mapRegion.height
                };
            }
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const screenX = (e.clientX - rect.left) * scaleX;
        const screenY = (e.clientY - rect.top) * scaleY;

        // Handle panning
        if (this.isPanning) {
            const dx = (e.clientX - this.panStartX) * scaleX;
            const dy = (e.clientY - this.panStartY) * scaleY;
            this.panX = this.lastPanX + dx;
            this.panY = this.lastPanY + dy;
            this.constrainPan();
            this.render();
            return;
        }

        const canvasCoords = this.screenToCanvas(screenX, screenY);
        const x = canvasCoords.x;
        const y = canvasCoords.y;

        // Handle geometry interactions when visible
        if (this.geometryVisible && this.geometryManager) {
            const handled = this.geometryManager.handleMouseMove(x, y);
            const cursor = this.geometryManager.updateCursor(x, y);
            if (cursor !== 'default') {
                this.canvas.style.cursor = cursor;
            }
            if (handled) {
                this.render();
                return;
            }
        }

        // Handle observed position interactions when visible
        if (this.observedPositionVisible && this.observedPositionManager) {
            const handled = this.observedPositionManager.handleMouseMove(x, y);
            const cursor = this.observedPositionManager.updateCursor(x, y);
            if (cursor !== 'default') {
                this.canvas.style.cursor = cursor;
            }
            if (handled) {
                this.render();
                return;
            }
        }

        // Handle divider interactions when dividers are visible
        if (this.dividerVisible && this.dividerManager) {
            this.dividerManager.setPreviewMouse(x, y);
            const handled = this.dividerManager.handleMouseMove(x, y);
            const cursor = this.dividerManager.updateCursor(x, y);
            this.canvas.style.cursor = cursor;
            if (handled) {
                this.render();
                return;
            }
            // If in placement mode, render to show preview
            if (this.dividerManager.placementMode) {
                this.render();
            }
        }

        // Handle triangle interactions when triangles are visible
        if (this.trianglesVisible && this.triangleManager) {
            const handled = this.triangleManager.handleMouseMove(x, y);
            const cursor = this.triangleManager.updateCursor(x, y);
            this.canvas.style.cursor = cursor;
            if (handled) {
                this.render();
                return;
            }
        }

        if (this.mapRegion && this.mapRegion.isDragging) {
            const dx = x - this.mapRegion.dragStartX;
            const dy = y - this.mapRegion.dragStartY;

            this.updateRegionFromDrag(dx, dy);
            this.render();
        } else if (this.mode === 'fit' && this.mapRegion) {
            const handle = this.mapRegion.hitTest(x, y);
            this.canvas.style.cursor = handle ?
                this.mapRegion.handles[handle].cursor : 'default';
        } else if (this.mode === 'view' && this.mapper) {
            this.showCoordinates(x, y);
        }
    }

    handleMouseUp(e) {
        // Stop panning
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
            return;
        }

        // Handle geometry interactions when visible
        if (this.geometryVisible && this.geometryManager) {
            const handled = this.geometryManager.handleMouseUp();
            if (handled) {
                this.render();
                return;
            }
        }

        // Handle observed position interactions when visible
        if (this.observedPositionVisible && this.observedPositionManager) {
            const handled = this.observedPositionManager.handleMouseUp();
            if (handled) {
                this.render();
                return;
            }
        }

        // Handle divider interactions when dividers are visible
        if (this.dividerVisible && this.dividerManager) {
            const handled = this.dividerManager.handleMouseUp();
            if (handled) {
                this.render();
                return;
            }
        }

        // Handle triangle interactions when triangles are visible
        if (this.trianglesVisible && this.triangleManager) {
            const handled = this.triangleManager.handleMouseUp();
            if (handled) {
                this.render();
                return;
            }
        }

        if (this.mapRegion && this.mapRegion.isDragging) {
            this.mapRegion.isDragging = false;
            this.mapRegion.dragHandle = null;

            // Update mapper with new region
            if (this.geoBounds) {
                this.mapper = new CoordinateMapper(
                    this.mapRegion,
                    this.geoBounds,
                    this.projection
                );
            }

            this.render();
        }
    }

    updateRegionFromDrag(dx, dy) {
        const handle = this.mapRegion.dragHandle;
        const start = this.dragStartRegion;

        switch (handle) {
            case 'center':
                this.mapRegion.x = start.x + dx;
                this.mapRegion.y = start.y + dy;
                break;
            case 'topLeft':
                this.mapRegion.x = start.x + dx;
                this.mapRegion.y = start.y + dy;
                this.mapRegion.width = start.width - dx;
                this.mapRegion.height = start.height - dy;
                break;
            case 'topRight':
                this.mapRegion.y = start.y + dy;
                this.mapRegion.width = start.width + dx;
                this.mapRegion.height = start.height - dy;
                break;
            case 'bottomLeft':
                this.mapRegion.x = start.x + dx;
                this.mapRegion.width = start.width - dx;
                this.mapRegion.height = start.height + dy;
                break;
            case 'bottomRight':
                this.mapRegion.width = start.width + dx;
                this.mapRegion.height = start.height + dy;
                break;
            case 'topCenter':
                this.mapRegion.y = start.y + dy;
                this.mapRegion.height = start.height - dy;
                break;
            case 'bottomCenter':
                this.mapRegion.height = start.height + dy;
                break;
            case 'leftCenter':
                this.mapRegion.x = start.x + dx;
                this.mapRegion.width = start.width - dx;
                break;
            case 'rightCenter':
                this.mapRegion.width = start.width + dx;
                break;
        }

        // Enforce minimum size
        if (this.mapRegion.width < 100) this.mapRegion.width = 100;
        if (this.mapRegion.height < 100) this.mapRegion.height = 100;
    }

    showCoordinates(x, y) {
        if (!this.mapper) return;

        const geo = this.mapper.screenToGeographic(x, y);

        // Remembered so the copy shortcut has a position to work from. The
        // readout keeps showing this once the pointer leaves the canvas, so
        // what gets copied is always what is on screen.
        this.lastCursorGeo = geo;

        this.renderCursorCoords();
    }

    /**
     * Paint the readout from the remembered position. Kept separate from
     * showCoordinates() so the copy confirmation can hand the panel back
     * without capturing — and later restoring — a stale snapshot of it.
     */
    renderCursorCoords() {
        const display = document.getElementById('cursorCoords');
        if (!display || !this.lastCursorGeo) return;
        display.innerHTML = `
                <strong>Lat:</strong> ${decimalToNautical(this.lastCursorGeo.lat, true)}<br>
                <strong>Lon:</strong> ${decimalToNautical(this.lastCursorGeo.lon, false)}
            `;
    }

    /**
     * The cursor position as a single line, in the same nautical notation the
     * panel displays. Round-trips through parseCoordinate(), so it can be
     * pasted back into the bounds fields or a calculator.
     *
     * @returns {string|null} e.g. "54°22.10'N 018°30.00'E", or null if the
     *          pointer has not been over the map yet.
     */
    formatCursorCoords() {
        if (!this.lastCursorGeo) return null;
        const lat = decimalToNautical(this.lastCursorGeo.lat, true);
        const lon = decimalToNautical(this.lastCursorGeo.lon, false);
        return `${lat} ${lon}`;
    }

    /**
     * "C" copies the cursor position to the clipboard.
     *
     * Every modifier combination is ignored, so Ctrl+C / Cmd+C keep their
     * normal meaning and never reach this handler. Key presses aimed at a
     * form field are ignored too, so typing "c" into the bounds inputs or a
     * calculator does not copy.
     */
    handleCopyShortcut(e) {
        if (e.key !== 'c' && e.key !== 'C') return;
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        if (!this.pointerOverCanvas) return;

        const el = e.target;
        if (el && (el.isContentEditable ||
                   /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''))) {
            return;
        }

        const text = this.formatCursorCoords();
        if (!text) return;

        e.preventDefault();
        copyTextToClipboard(text).then((ok) => {
            this.flashCursorCoords(ok
                ? `<strong>✓ Copied</strong><br>${text}`
                : '<strong>Copy failed</strong>');
        });
    }

    /**
     * Show a transient message in the readout, then hand the panel back to
     * the live coordinates.
     */
    flashCursorCoords(message) {
        const display = document.getElementById('cursorCoords');
        if (!display) return;
        clearTimeout(this._copyFlashTimer);
        display.innerHTML = message;
        this._copyFlashTimer = setTimeout(() => this.renderCursorCoords(), 1500);
    }

    // ——— Render ———

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.uploadedImage) {
            // Save context state
            this.ctx.save();

            // Apply zoom and pan transformation
            this.ctx.translate(this.panX, this.panY);
            this.ctx.scale(this.zoom, this.zoom);

            // Draw image
            this.ctx.drawImage(this.uploadedImage, 0, 0);

            // Draw map region (in fit mode)
            if (this.mode === 'fit' && this.mapRegion) {
                this.mapRegion.draw(this.ctx, true);
            }

            // Draw graticule (in view mode with mapper)
            if (this.mode === 'view' && this.mapper) {
                this.drawGraticule();
            }

            // Draw nautical dividers (when visible)
            if (this.dividerVisible && this.dividerManager) {
                this.dividerManager.drawAll(this.ctx);
            }

            // Draw GPX routes (when visible)
            if (this.gpxVisible && this.gpxManager && this.mapper) {
                this.gpxManager.drawAll(this.ctx, this.mapper);
            }

            // Draw observed positions (when visible)
            if (this.observedPositionVisible && this.observedPositionManager) {
                this.observedPositionManager.drawAll(this.ctx);
            }

            // Draw geometry (points, connections, rays) when visible
            if (this.geometryVisible && this.geometryManager) {
                this.geometryManager.drawAll(this.ctx);
            }

            // Draw nautical triangles (inside zoom/pan so they scale with the map)
            if (this.trianglesVisible && this.triangleManager) {
                this.triangleManager.drawAll(this.ctx);
            }

            // Restore context state
            this.ctx.restore();
        }

        // Draw zoom indicator (not affected by zoom transform)
        this.drawZoomIndicator();
    }

    drawZoomIndicator() {
        if (this.zoom === 1.0) return;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 80, 30);
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(Math.round(this.zoom * 100) + '%', 50, 25);
        this.ctx.restore();
    }
}

// Make available globally
window.EnhancedGraticuleSystem = EnhancedGraticuleSystem;
