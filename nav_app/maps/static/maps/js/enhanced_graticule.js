/**
 * Enhanced Interactive Graticule System
 * Professional-grade geographic coordinate overlay with:
 * - Interactive map region fitting (for images with margins/legends)
 * - Proper Mercator projection
 * - Region repositioning and resizing
 * - Export capabilities (SVG, high-res PNG)
 */

class MercatorProjection {
    /**
     * Convert latitude to Mercator Y coordinate
     * Formula: y = ln(tan(π/4 + φ/2))
     */
    latitudeToMercatorY(lat) {
        // Clamp to avoid infinity at poles
        const clampedLat = Math.max(-85, Math.min(85, lat));
        const latRad = clampedLat * Math.PI / 180;
        return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    }

    /**
     * Convert Mercator Y to latitude
     * Inverse: lat = 2 * atan(e^y) - π/2
     */
    mercatorYToLatitude(y) {
        const latRad = 2 * Math.atan(Math.exp(y)) - Math.PI / 2;
        return latRad * 180 / Math.PI;
    }

    /**
     * Convert longitude to Mercator X (linear)
     */
    longitudeToMercatorX(lon) {
        return lon * Math.PI / 180;
    }

    /**
     * Convert Mercator X to longitude
     */
    mercatorXToLongitude(x) {
        return x * 180 / Math.PI;
    }

    /**
     * Full forward projection (lat/lon → Mercator)
     */
    project(lat, lon) {
        return {
            x: this.longitudeToMercatorX(lon),
            y: this.latitudeToMercatorY(lat)
        };
    }

    /**
     * Full inverse projection (Mercator → lat/lon)
     */
    unproject(x, y) {
        return {
            lat: this.mercatorYToLatitude(y),
            lon: this.mercatorXToLongitude(x)
        };
    }
}

class MapRegion {
    constructor(x = 0, y = 0, width = 800, height = 600) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.isDragging = false;
        this.dragHandle = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.handles = this.createHandles();
    }

    createHandles() {
        const handleSize = 10;
        return {
            topLeft: { cursor: 'nwse-resize', type: 'corner' },
            topRight: { cursor: 'nesw-resize', type: 'corner' },
            bottomLeft: { cursor: 'nesw-resize', type: 'corner' },
            bottomRight: { cursor: 'nwse-resize', type: 'corner' },
            topCenter: { cursor: 'ns-resize', type: 'edge' },
            bottomCenter: { cursor: 'ns-resize', type: 'edge' },
            leftCenter: { cursor: 'ew-resize', type: 'edge' },
            rightCenter: { cursor: 'ew-resize', type: 'edge' },
            center: { cursor: 'move', type: 'move' }
        };
    }

    getHandlePositions() {
        const h = 10; // handle size
        return {
            topLeft: { x: this.x - h/2, y: this.y - h/2, w: h, h: h },
            topRight: { x: this.x + this.width - h/2, y: this.y - h/2, w: h, h: h },
            bottomLeft: { x: this.x - h/2, y: this.y + this.height - h/2, w: h, h: h },
            bottomRight: { x: this.x + this.width - h/2, y: this.y + this.height - h/2, w: h, h: h },
            topCenter: { x: this.x + this.width/2 - h/2, y: this.y - h/2, w: h, h: h },
            bottomCenter: { x: this.x + this.width/2 - h/2, y: this.y + this.height - h/2, w: h, h: h },
            leftCenter: { x: this.x - h/2, y: this.y + this.height/2 - h/2, w: h, h: h },
            rightCenter: { x: this.x + this.width - h/2, y: this.y + this.height/2 - h/2, w: h, h: h },
            center: { x: this.x, y: this.y, w: this.width, h: this.height }
        };
    }

    hitTest(x, y) {
        const positions = this.getHandlePositions();
        
        // Check handles first (smaller targets)
        for (const [name, pos] of Object.entries(positions)) {
            if (name === 'center') continue; // Check last
            if (x >= pos.x && x <= pos.x + pos.w && 
                y >= pos.y && y <= pos.y + pos.h) {
                return name;
            }
        }
        
        // Check center (move entire region)
        const center = positions.center;
        if (x >= center.x && x <= center.x + center.w && 
            y >= center.y && y <= center.y + center.h) {
            return 'center';
        }
        
        return null;
    }

    draw(ctx, isActive = false) {
        ctx.save();
        
        // Draw region border
        ctx.strokeStyle = isActive ? '#FF5722' : '#0078A8';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // Draw semi-transparent overlay outside region
        if (isActive) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, ctx.canvas.width, this.y); // Top
            ctx.fillRect(0, this.y, this.x, this.height); // Left
            ctx.fillRect(this.x + this.width, this.y, 
                        ctx.canvas.width - this.x - this.width, this.height); // Right
            ctx.fillRect(0, this.y + this.height, 
                        ctx.canvas.width, ctx.canvas.height - this.y - this.height); // Bottom
        }
        
        // Draw handles
        if (isActive) {
            const positions = this.getHandlePositions();
            ctx.setLineDash([]);
            
            for (const [name, pos] of Object.entries(positions)) {
                if (name === 'center') continue;
                
                ctx.fillStyle = '#FF5722';
                ctx.fillRect(pos.x, pos.y, pos.w, pos.h);
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.strokeRect(pos.x, pos.y, pos.w, pos.h);
            }
        }
        
        ctx.restore();
    }
}

class CoordinateMapper {
    constructor(mapRegion, geoBounds, projection) {
        this.mapRegion = mapRegion;
        this.geoBounds = geoBounds;
        this.projection = projection;
        this.updateMercatorBounds();
    }

    updateMercatorBounds() {
        const topLeft = this.projection.project(
            this.geoBounds.maxLat,
            this.geoBounds.minLon
        );
        const bottomRight = this.projection.project(
            this.geoBounds.minLat,
            this.geoBounds.maxLon
        );
        
        this.mercatorBounds = {
            minX: topLeft.x,
            maxX: bottomRight.x,
            minY: topLeft.y,
            maxY: bottomRight.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }

    geographicToScreen(lat, lon) {
        const mercator = this.projection.project(lat, lon);
        
        // Normalize to [0, 1]
        const normX = (mercator.x - this.mercatorBounds.minX) / this.mercatorBounds.width;
        const normY = (mercator.y - this.mercatorBounds.minY) / this.mercatorBounds.height;
        
        // Map to region
        const screenX = this.mapRegion.x + normX * this.mapRegion.width;
        const screenY = this.mapRegion.y + normY * this.mapRegion.height;
        
        return { x: screenX, y: screenY };
    }

    screenToGeographic(screenX, screenY) {
        // Region relative
        const relX = screenX - this.mapRegion.x;
        const relY = screenY - this.mapRegion.y;
        
        // Normalize
        const normX = relX / this.mapRegion.width;
        const normY = relY / this.mapRegion.height;
        
        // Mercator space
        const mercatorX = this.mercatorBounds.minX + normX * this.mercatorBounds.width;
        const mercatorY = this.mercatorBounds.minY + normY * this.mercatorBounds.height;
        
        return this.projection.unproject(mercatorX, mercatorY);
    }
}

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
        // User can configure these independently via UI using degrees, minutes, seconds
        this.latInterval = 0.5; // Parallel (latitude line) spacing - default 30 arcminutes
        this.lonInterval = 0.5; // Meridian (longitude line) spacing - default 30 arcminutes
        this.showMinorGrid = false;

        // Zoom and pan state
        this.zoom = 1.0;
        this.minZoom = 0.5;
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

        // Track touch state for pinch zoom
        this.touches = [];
        this.initialPinchDistance = 0;
        this.initialZoom = 1;
    }

    /**
     * Handle mouse wheel for zoom
     */
    handleWheel(e) {
        e.preventDefault();

        // Don't zoom when a triangle is selected (arrow keys control it instead)
        if (this.triangleManager?.selectedTriangle) return;

        if (!this.uploadedImage) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // Mouse position in canvas coordinates
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // Zoom factor
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

        if (newZoom !== this.zoom) {
            // Zoom towards mouse position
            const zoomRatio = newZoom / this.zoom;

            // Adjust pan to zoom towards mouse cursor
            this.panX = mouseX - (mouseX - this.panX) * zoomRatio;
            this.panY = mouseY - (mouseY - this.panY) * zoomRatio;

            this.zoom = newZoom;
            this.constrainPan();
            this.render();
            this.updateZoomDisplay();
        }
    }

    /**
     * Handle touch start for pinch zoom
     */
    handleTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            this.touches = Array.from(e.touches);
            this.initialPinchDistance = this.getPinchDistance(e.touches);
            this.initialZoom = this.zoom;
            this.isPanning = false;
        } else if (e.touches.length === 1) {
            // Single touch - could be pan
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.panStartX = touch.clientX;
            this.panStartY = touch.clientY;
            this.lastPanX = this.panX;
            this.lastPanY = this.panY;
        }
    }

    /**
     * Handle touch move for pinch zoom
     */
    handleTouchMove(e) {
        if (e.touches.length === 2 && this.initialPinchDistance > 0) {
            e.preventDefault();
            const currentDistance = this.getPinchDistance(e.touches);
            const scale = currentDistance / this.initialPinchDistance;
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.initialZoom * scale));

            if (newZoom !== this.zoom) {
                // Get center of pinch
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
            // Single touch pan when zoomed in
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

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        if (e.touches.length < 2) {
            this.initialPinchDistance = 0;
            this.touches = [];
        }
    }

    /**
     * Get distance between two touch points
     */
    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Constrain pan to keep image visible
     */
    constrainPan() {
        if (!this.uploadedImage) return;

        const scaledWidth = this.canvas.width * this.zoom;
        const scaledHeight = this.canvas.height * this.zoom;

        // Allow some margin outside the image
        const margin = 50;

        // Maximum pan values (how far the image can move)
        const maxPanX = scaledWidth - this.canvas.width + margin;
        const maxPanY = scaledHeight - this.canvas.height + margin;

        // Constrain pan
        this.panX = Math.max(-maxPanX, Math.min(margin, this.panX));
        this.panY = Math.max(-maxPanY, Math.min(margin, this.panY));
    }

    /**
     * Zoom in
     */
    zoomIn() {
        const newZoom = Math.min(this.maxZoom, this.zoom * 1.25);
        if (newZoom !== this.zoom) {
            // Zoom towards center
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

    /**
     * Zoom out
     */
    zoomOut() {
        const newZoom = Math.max(this.minZoom, this.zoom / 1.25);
        if (newZoom !== this.zoom) {
            // Zoom towards center
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

    /**
     * Reset zoom to 100%
     */
    resetZoom() {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.render();
        this.updateZoomDisplay();
    }

    /**
     * Set zoom level
     */
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

    /**
     * Get current zoom level
     */
    getZoom() {
        return this.zoom;
    }

    /**
     * Update zoom display in UI
     */
    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = Math.round(this.zoom * 100) + '%';
        }
    }

    /**
     * Convert screen coordinates to canvas coordinates (accounting for zoom/pan)
     */
    screenToCanvas(screenX, screenY) {
        return {
            x: (screenX - this.panX) / this.zoom,
            y: (screenY - this.panY) / this.zoom
        };
    }

    /**
     * Convert canvas coordinates to screen coordinates
     */
    canvasToScreen(canvasX, canvasY) {
        return {
            x: canvasX * this.zoom + this.panX,
            y: canvasY * this.zoom + this.panY
        };
    }

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

    /**
     * Define geographic bounds for the map region.
     * Optionally define graticule intervals at the same time (recommended),
     * so "defining bounds" also defines the grid frequencies.
     *
     * @param {number} minLat
     * @param {number} maxLat
     * @param {number} minLon
     * @param {number} maxLon
     * @param {{latInterval:number, lonInterval:number}=} grid
     */
    setGeographicBounds(minLat, maxLat, minLon, maxLon, grid = undefined) {
        // Always define grid intervals at the moment bounds are defined.
        // Backwards compatible: if caller doesn't pass grid, use current intervals.
        const resolvedGrid = (grid && typeof grid === 'object')
            ? grid
            : { latInterval: this.latInterval, lonInterval: this.lonInterval };

        if (typeof resolvedGrid.latInterval === 'number' && typeof resolvedGrid.lonInterval === 'number') {
            // Validate+apply (keeps meridians/parallels independent)
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

    /**
     * Set graticule grid intervals
     * @param {number} latInterval - Parallel spacing in decimal degrees
     * @param {number} lonInterval - Meridian spacing in decimal degrees
     * @throws {Error} If intervals are invalid
     */
    setGridIntervals(latInterval, lonInterval) {
        // Use validation method
        const validation = this.validateIntervals(latInterval, lonInterval);
        if (!validation.valid) {
            throw new Error('Invalid grid intervals: ' + validation.errors.join(', '));
        }

        // Store the intervals
        this.latInterval = latInterval;
        this.lonInterval = lonInterval;

        // Log for debugging
        console.log(`Grid intervals set - Parallels: ${this.formatIntervalDMS(latInterval)}, Meridians: ${this.formatIntervalDMS(lonInterval)}`);

        // Only render if we have a mapper (bounds have been applied)
        if (this.mapper) {
            this.render();
        }
    }

    /**
     * Get current grid intervals
     * @returns {Object} Object with latInterval and lonInterval in decimal degrees
     */
    getGridIntervals() {
        return {
            latInterval: this.latInterval,
            lonInterval: this.lonInterval
        };
    }

    /**
     * Get human-readable description of current grid intervals
     * @returns {Object} Object with formatted strings for parallels and meridians
     */
    getGridIntervalsFormatted() {
        return {
            parallels: this.formatIntervalDMS(this.latInterval),
            meridians: this.formatIntervalDMS(this.lonInterval)
        };
    }

    /**
     * Format a decimal degree interval as DMS string
     * @param {number} decimal - Interval in decimal degrees
     * @returns {string} Formatted string (e.g., "0° 30' 0\"" or "1'")
     */
    formatIntervalDMS(decimal) {
        if (decimal == null || isNaN(decimal)) return 'N/A';

        const degrees = Math.floor(decimal);
        const minutesDecimal = (decimal - degrees) * 60;
        const minutes = Math.floor(minutesDecimal);
        const seconds = ((minutesDecimal - minutes) * 60);

        // Format based on what's non-zero
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

    /**
     * Set grid intervals from DMS (degrees, minutes, seconds) format
     * @param {Object} parallels - {degrees, minutes, seconds} for latitude lines
     * @param {Object} meridians - {degrees, minutes, seconds} for longitude lines
     */
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

    /**
     * Convert DMS to decimal degrees
     * @param {number} degrees
     * @param {number} minutes
     * @param {number} seconds
     * @returns {number} Decimal degrees
     */
    dmsToDecimal(degrees, minutes, seconds) {
        degrees = parseFloat(degrees) || 0;
        minutes = parseFloat(minutes) || 0;
        seconds = parseFloat(seconds) || 0;
        return degrees + (minutes / 60) + (seconds / 3600);
    }

    /**
     * Apply a preset grid configuration
     * @param {string} presetName - 'fine', 'standard', 'coarse', 'nautical', or custom object
     */
    applyGridPreset(presetName) {
        const presets = {
            // Fine: 1 minute for both
            fine: { latInterval: 1/60, lonInterval: 1/60 },
            // Standard: 30 minutes for both
            standard: { latInterval: 0.5, lonInterval: 0.5 },
            // Coarse: 1 degree for both
            coarse: { latInterval: 1, lonInterval: 1 },
            // Nautical: 1 minute parallels, 30 minutes meridians
            nautical: { latInterval: 1/60, lonInterval: 0.5 },
            // Very fine: 30 seconds for both
            veryFine: { latInterval: 30/3600, lonInterval: 30/3600 }
        };

        const preset = typeof presetName === 'string' ? presets[presetName] : presetName;

        if (preset && preset.latInterval && preset.lonInterval) {
            this.setGridIntervals(preset.latInterval, preset.lonInterval);
        } else {
            console.warn('Unknown or invalid preset:', presetName);
        }
    }

    /**
     * Validate grid interval values
     * @param {number} latInterval - Latitude interval in decimal degrees
     * @param {number} lonInterval - Longitude interval in decimal degrees
     * @returns {Object} { valid: boolean, errors: string[] }
     */
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

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Account for CSS scaling
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const screenX = (e.clientX - rect.left) * scaleX;
        const screenY = (e.clientY - rect.top) * scaleY;

        // Convert to canvas coordinates (account for zoom/pan)
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
        // Pass Ctrl/Meta key state for rotation mode
        if (this.trianglesVisible && this.triangleManager) {
            const handled = this.triangleManager.handleMouseDown(x, y);
            if (handled) {
                this.render();
                return;
            }
        }
        
        // Handle region fitting in fit mode
        if (this.mode === 'fit' && this.mapRegion) {
            const handle = this.mapRegion.hitTest(x, y);
            if (handle) {
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
        // Account for CSS scaling
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

        // Convert to canvas coordinates (account for zoom/pan)
        const canvasCoords = this.screenToCanvas(screenX, screenY);
        const x = canvasCoords.x;
        const y = canvasCoords.y;

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
            // Update cursor
            const handle = this.mapRegion.hitTest(x, y);
            this.canvas.style.cursor = handle ?
                this.mapRegion.handles[handle].cursor : 'default';
        } else if (this.mode === 'view' && this.mapper) {
            // Show coordinates
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
        
        // Update display element if it exists
        const display = document.getElementById('cursorCoords');
        if (display) {
            display.innerHTML = `
                <strong>Lat:</strong> ${decimalToNautical(geo.lat, true)}<br>
                <strong>Lon:</strong> ${decimalToNautical(geo.lon, false)}
            `;
        }
    }

    render() {
        if (!this.uploadedImage) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

        // Draw nautical triangles (when visible)
        if (this.trianglesVisible && this.triangleManager) {
            this.triangleManager.drawAll(this.ctx);
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

        // Restore context state
        this.ctx.restore();

        // Draw zoom indicator (not affected by zoom transform)
        this.drawZoomIndicator();
    }

    /**
     * Draw zoom indicator on canvas
     */
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

    drawGraticule() {
        if (!this.mapper || !this.geoBounds) return;

        // Validate intervals before drawing
        if (!this.latInterval || this.latInterval <= 0) {
            console.warn('Invalid latInterval, using default 0.5');
            this.latInterval = 0.5;
        }
        if (!this.lonInterval || this.lonInterval <= 0) {
            console.warn('Invalid lonInterval, using default 0.5');
            this.lonInterval = 0.5;
        }

        this.ctx.save();
        this.ctx.strokeStyle = '#0078A8';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([5, 5]);
        this.ctx.globalAlpha = 0.7;

        // Determine label display mode based on interval size
        // For fine intervals (< 1 minute), show seconds
        // For medium intervals (< 1 degree), show minutes
        // For coarse intervals (>= 1 degree), show degrees
        const latLabelMode = this.getLabelMode(this.latInterval);
        const lonLabelMode = this.getLabelMode(this.lonInterval);

        // Draw latitude lines (parallels) - horizontal lines
        // Uses this.latInterval for spacing (can be set independently from meridians)
        const startLat = Math.floor(this.geoBounds.minLat / this.latInterval) * this.latInterval;
        const endLat = Math.ceil(this.geoBounds.maxLat / this.latInterval) * this.latInterval;

        // Prevent infinite loops for very small intervals
        const maxLatLines = 200;
        let latLineCount = 0;

        for (let lat = startLat; lat <= endLat && latLineCount < maxLatLines; lat += this.latInterval) {
            // Use epsilon comparison for floating point
            if (lat < this.geoBounds.minLat - 0.0001 || lat > this.geoBounds.maxLat + 0.0001) continue;
            latLineCount++;

            const isWholeDegree = Math.abs(lat - Math.round(lat)) < 0.0001;
            const isWholeMinute = Math.abs((lat * 60) - Math.round(lat * 60)) < 0.001;

            // Determine line style based on significance
            const isMajor = isWholeDegree || (this.latInterval < 1 && isWholeMinute && !isWholeDegree);

            // Draw line
            const start = this.mapper.geographicToScreen(lat, this.geoBounds.minLon);
            const end = this.mapper.geographicToScreen(lat, this.geoBounds.maxLon);

            if (isWholeDegree) {
                this.ctx.save();
                this.ctx.lineWidth = 2.5;
                this.ctx.globalAlpha = 0.9;
                this.ctx.setLineDash([]);
            } else if (isMajor) {
                this.ctx.save();
                this.ctx.lineWidth = 2;
                this.ctx.globalAlpha = 0.8;
            }

            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.stroke();

            if (isWholeDegree || isMajor) {
                this.ctx.restore();
            }

            // Draw label with appropriate format
            this.drawLatitudeLabel(lat, start.x + 10, start.y, isWholeDegree, latLabelMode);
        }

        // Draw longitude lines (meridians) - vertical lines
        // Uses this.lonInterval for spacing (can be set independently from parallels)
        const startLon = Math.floor(this.geoBounds.minLon / this.lonInterval) * this.lonInterval;
        const endLon = Math.ceil(this.geoBounds.maxLon / this.lonInterval) * this.lonInterval;

        // Prevent infinite loops for very small intervals
        const maxLonLines = 200;
        let lonLineCount = 0;

        for (let lon = startLon; lon <= endLon && lonLineCount < maxLonLines; lon += this.lonInterval) {
            // Use epsilon comparison for floating point
            if (lon < this.geoBounds.minLon - 0.0001 || lon > this.geoBounds.maxLon + 0.0001) continue;
            lonLineCount++;

            const isWholeDegree = Math.abs(lon - Math.round(lon)) < 0.0001;
            const isWholeMinute = Math.abs((lon * 60) - Math.round(lon * 60)) < 0.001;

            // Determine line style based on significance
            const isMajor = isWholeDegree || (this.lonInterval < 1 && isWholeMinute && !isWholeDegree);

            // Draw line
            const start = this.mapper.geographicToScreen(this.geoBounds.maxLat, lon);
            const end = this.mapper.geographicToScreen(this.geoBounds.minLat, lon);

            if (isWholeDegree) {
                this.ctx.save();
                this.ctx.lineWidth = 2.5;
                this.ctx.globalAlpha = 0.9;
                this.ctx.setLineDash([]);
            } else if (isMajor) {
                this.ctx.save();
                this.ctx.lineWidth = 2;
                this.ctx.globalAlpha = 0.8;
            }

            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.stroke();

            if (isWholeDegree || isMajor) {
                this.ctx.restore();
            }

            // Draw label with appropriate format
            this.drawLongitudeLabel(lon, start.x, start.y + 20, isWholeDegree, lonLabelMode);
        }

        this.ctx.restore();
    }

    /**
     * Determine label display mode based on interval size
     * @param {number} interval - Interval in decimal degrees
     * @returns {string} 'degrees', 'minutes', or 'seconds'
     */
    getLabelMode(interval) {
        if (interval >= 1) {
            return 'degrees';
        } else if (interval >= 1/60) { // >= 1 minute
            return 'minutes';
        } else {
            return 'seconds';
        }
    }

    drawLatitudeLabel(lat, x, y, isWholeDegree, labelMode = 'minutes') {
        let label;
        const abs = Math.abs(lat);
        const direction = lat >= 0 ? 'N' : 'S';
        const degrees = Math.floor(abs);
        const minutesDecimal = (abs - degrees) * 60;
        const minutes = Math.floor(minutesDecimal);
        const seconds = (minutesDecimal - minutes) * 60;

        if (isWholeDegree) {
            // Always show full format for whole degrees
            label = `${degrees}°${direction}`;
        } else if (labelMode === 'seconds') {
            // Fine grid: show minutes and seconds
            if (degrees > 0) {
                label = `${degrees}°${minutes}'${seconds.toFixed(0)}"`;
            } else {
                label = `${minutes}'${seconds.toFixed(0)}"`;
            }
        } else if (labelMode === 'minutes') {
            // Medium grid: show minutes (with decimal if needed)
            const isWholeMinute = Math.abs(minutesDecimal - Math.round(minutesDecimal)) < 0.01;
            if (degrees > 0 && isWholeMinute) {
                label = `${degrees}°${Math.round(minutesDecimal)}'${direction}`;
            } else if (isWholeMinute) {
                label = `${Math.round(minutesDecimal)}'`;
            } else {
                label = `${minutesDecimal.toFixed(1)}'`;
            }
        } else {
            // Coarse grid: show degrees
            label = `${abs.toFixed(1)}°${direction}`;
        }

        this.ctx.save();
        this.ctx.font = isWholeDegree ? 'bold 13px monospace' : 'normal 11px monospace';
        const labelWidth = this.ctx.measureText(label).width + 8;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.fillRect(x - 2, y - 12, labelWidth, 24);

        this.ctx.strokeStyle = '#0078A8';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - 2, y - 12, labelWidth, 24);

        this.ctx.fillStyle = '#0078A8';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, x + 2, y);
        this.ctx.restore();
    }

    drawLongitudeLabel(lon, x, y, isWholeDegree, labelMode = 'minutes') {
        let label;
        const abs = Math.abs(lon);
        const direction = lon >= 0 ? 'E' : 'W';
        const degrees = Math.floor(abs);
        const minutesDecimal = (abs - degrees) * 60;
        const minutes = Math.floor(minutesDecimal);
        const seconds = (minutesDecimal - minutes) * 60;

        if (isWholeDegree) {
            // Always show full format for whole degrees
            label = `${degrees.toString().padStart(3, '0')}°${direction}`;
        } else if (labelMode === 'seconds') {
            // Fine grid: show minutes and seconds
            if (degrees > 0) {
                label = `${degrees}°${minutes}'${seconds.toFixed(0)}"`;
            } else {
                label = `${minutes}'${seconds.toFixed(0)}"`;
            }
        } else if (labelMode === 'minutes') {
            // Medium grid: show minutes (with decimal if needed)
            const isWholeMinute = Math.abs(minutesDecimal - Math.round(minutesDecimal)) < 0.01;
            if (degrees > 0 && isWholeMinute) {
                label = `${degrees.toString().padStart(3, '0')}°${Math.round(minutesDecimal)}'${direction}`;
            } else if (isWholeMinute) {
                label = `${Math.round(minutesDecimal)}'`;
            } else {
                label = `${minutesDecimal.toFixed(1)}'`;
            }
        } else {
            // Coarse grid: show degrees
            label = `${abs.toFixed(1)}°${direction}`;
        }

        this.ctx.save();
        this.ctx.font = isWholeDegree ? 'bold 13px monospace' : 'normal 11px monospace';
        const width = this.ctx.measureText(label).width + 10;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.fillRect(x - width/2, y - 2, width, 24);

        this.ctx.strokeStyle = '#0078A8';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - width/2, y - 2, width, 24);

        this.ctx.fillStyle = '#0078A8';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(label, x, y + 2);
        this.ctx.restore();
    }

    exportSVG() {
        if (!this.mapper || !this.geoBounds) return null;

        // Validate intervals
        if (!this.latInterval || this.latInterval <= 0 || !this.lonInterval || this.lonInterval <= 0) {
            console.error('Invalid grid intervals for SVG export');
            return null;
        }

        const width = this.mapRegion.width;
        const height = this.mapRegion.height;

        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
    <style>
        .graticule-major { stroke: #0078A8; stroke-width: 2.5; opacity: 0.9; }
        .graticule-minor { stroke: #0078A8; stroke-width: 1.5; stroke-dasharray: 5,5; opacity: 0.7; }
        .graticule-medium { stroke: #0078A8; stroke-width: 2; opacity: 0.8; }
    </style>
</defs>
<g id="graticule">
`;

        // Use independent intervals for parallels and meridians
        const startLat = Math.floor(this.geoBounds.minLat / this.latInterval) * this.latInterval;
        const endLat = Math.ceil(this.geoBounds.maxLat / this.latInterval) * this.latInterval;
        const startLon = Math.floor(this.geoBounds.minLon / this.lonInterval) * this.lonInterval;
        const endLon = Math.ceil(this.geoBounds.maxLon / this.lonInterval) * this.lonInterval;

        // Prevent infinite loops
        const maxLines = 200;
        let lineCount = 0;

        // Parallels (latitude lines) - use latInterval
        for (let lat = startLat; lat <= endLat && lineCount < maxLines; lat += this.latInterval) {
            if (lat < this.geoBounds.minLat - 0.0001 || lat > this.geoBounds.maxLat + 0.0001) continue;
            lineCount++;

            const start = this.mapper.geographicToScreen(lat, this.geoBounds.minLon);
            const end = this.mapper.geographicToScreen(lat, this.geoBounds.maxLon);
            const isWholeDegree = Math.abs(lat - Math.round(lat)) < 0.0001;
            const isWholeMinute = Math.abs((lat * 60) - Math.round(lat * 60)) < 0.001;

            const x1 = start.x - this.mapRegion.x;
            const y1 = start.y - this.mapRegion.y;
            const x2 = end.x - this.mapRegion.x;
            const y2 = end.y - this.mapRegion.y;

            let lineClass = 'graticule-minor';
            if (isWholeDegree) {
                lineClass = 'graticule-major';
            } else if (this.latInterval < 1 && isWholeMinute) {
                lineClass = 'graticule-medium';
            }

            svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${lineClass}"/>\n`;
        }

        lineCount = 0;

        // Meridians (longitude lines) - use lonInterval
        for (let lon = startLon; lon <= endLon && lineCount < maxLines; lon += this.lonInterval) {
            if (lon < this.geoBounds.minLon - 0.0001 || lon > this.geoBounds.maxLon + 0.0001) continue;
            lineCount++;

            const start = this.mapper.geographicToScreen(this.geoBounds.maxLat, lon);
            const end = this.mapper.geographicToScreen(this.geoBounds.minLat, lon);
            const isWholeDegree = Math.abs(lon - Math.round(lon)) < 0.0001;
            const isWholeMinute = Math.abs((lon * 60) - Math.round(lon * 60)) < 0.001;

            const x1 = start.x - this.mapRegion.x;
            const y1 = start.y - this.mapRegion.y;
            const x2 = end.x - this.mapRegion.x;
            const y2 = end.y - this.mapRegion.y;

            let lineClass = 'graticule-minor';
            if (isWholeDegree) {
                lineClass = 'graticule-major';
            } else if (this.lonInterval < 1 && isWholeMinute) {
                lineClass = 'graticule-medium';
            }

            svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${lineClass}"/>\n`;
        }

        svg += `</g>\n</svg>`;

        return svg;
    }

    exportHighResPNG(scaleFactor = 2) {
        if (!this.uploadedImage) return null;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width * scaleFactor;
        tempCanvas.height = this.canvas.height * scaleFactor;
        
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.scale(scaleFactor, scaleFactor);
        
        // Draw image
        tempCtx.drawImage(this.uploadedImage, 0, 0);
        
        // Temporarily scale mapper
        const originalRegion = {...this.mapRegion};
        this.mapRegion = new MapRegion(
            originalRegion.x * scaleFactor,
            originalRegion.y * scaleFactor,
            originalRegion.width * scaleFactor,
            originalRegion.height * scaleFactor
        );
        
        const originalMapper = this.mapper;
        this.mapper = new CoordinateMapper(
            this.mapRegion,
            this.geoBounds,
            this.projection
        );
        
        // Save original context and temporarily use temp context
        const originalCtx = this.ctx;
        this.ctx = tempCtx;
        
        // Draw graticule
        this.drawGraticule();
        
        // Restore
        this.ctx = originalCtx;
        this.mapRegion = originalRegion;
        this.mapper = originalMapper;
        
        return tempCanvas.toDataURL('image/png');
    }
    
    /**
     * Initialize nautical triangles
     */
    initTriangles() {
        if (!this.triangleManager) {
            this.triangleManager = new NauticalTriangleManager();
            const triangleSize = Math.min(this.canvas.width, this.canvas.height) * 0.25;
            this.triangleManager.createStandardPair(
                this.canvas.width,
                this.canvas.height,
                triangleSize
            );
            // Redraw canvas whenever arrow keys reposition a triangle
            this.triangleManager.onPositionChange = () => this.render();
        }
        return this.triangleManager;
    }
    
    /**
     * Toggle triangle visibility
     */
    toggleTriangles() {
        if (!this.triangleManager) {
            this.initTriangles();
        }
        this.trianglesVisible = !this.trianglesVisible;
        this.render();
        return this.trianglesVisible;
    }
    
    /**
     * Show triangles
     */
    showTriangles() {
        if (!this.triangleManager) {
            this.initTriangles();
        }
        this.trianglesVisible = true;
        this.render();
    }
    
    /**
     * Hide triangles
     */
    hideTriangles() {
        this.trianglesVisible = false;
        this.render();
    }
    
    /**
     * Get triangle rotation angles for reading courses/bearings
     */
    getTriangleAngles() {
        if (this.triangleManager) {
            return this.triangleManager.getRotationAngles();
        }
        return null;
    }
    
    /**
     * Initialize nautical divider
     */
    initDivider() {
        if (!this.dividerManager && this.mapper) {
            this.dividerManager = new NauticalDividerManager(
                this.mapper,
                this.projection
            );
        }
        return this.dividerManager;
    }
    
    /**
     * Toggle divider visibility
     */
    toggleDivider() {
        if (!this.dividerManager) {
            this.initDivider();
        }
        this.dividerVisible = !this.dividerVisible;
        this.render();
        return this.dividerVisible;
    }
    
    /**
     * Show divider
     */
    showDivider() {
        if (!this.dividerManager) {
            this.initDivider();
        }
        this.dividerVisible = true;
        this.render();
    }
    
    /**
     * Hide divider
     */
    hideDivider() {
        this.dividerVisible = false;
        if (this.dividerManager) {
            this.dividerManager.cancelPlacement();
        }
        this.render();
    }
    
    /**
     * Start divider placement
     */
    startDividerPlacement() {
        if (!this.dividerManager) {
            this.initDivider();
        }
        if (!this.dividerVisible) {
            this.dividerVisible = true;
        }
        this.dividerManager.startPlacement();
        this.render();
    }
    
    /**
     * Cancel divider placement
     */
    cancelDividerPlacement() {
        if (this.dividerManager) {
            this.dividerManager.cancelPlacement();
        }
        this.render();
    }
    
    /**
     * Delete selected divider
     */
    deleteSelectedDivider() {
        if (this.dividerManager) {
            const deleted = this.dividerManager.deleteSelected();
            if (deleted) {
                this.render();
            }
            return deleted;
        }
        return false;
    }
    
    /**
     * Clear all dividers
     */
    clearAllDividers() {
        if (this.dividerManager) {
            this.dividerManager.clearAll();
            this.render();
        }
    }
    
    /**
     * Get selected divider info
     */
    getSelectedDividerInfo() {
        if (this.dividerManager) {
            return this.dividerManager.getSelectedInfo();
        }
        return null;
    }
    
    /**
     * Initialize GPX routes manager
     */
    initGPXRoutes() {
        if (!this.gpxManager) {
            this.gpxManager = new GPXRoutesManagerCanvas();
        }
        return this.gpxManager;
    }
    
    /**
     * Toggle GPX routes visibility
     */
    toggleGPXRoutes() {
        if (!this.gpxManager) {
            this.initGPXRoutes();
        }
        this.gpxVisible = !this.gpxVisible;
        this.render();
        return this.gpxVisible;
    }
    
    /**
     * Show GPX routes
     */
    showGPXRoutes() {
        if (!this.gpxManager) {
            this.initGPXRoutes();
        }
        this.gpxVisible = true;
        this.render();
    }
    
    /**
     * Hide GPX routes
     */
    hideGPXRoutes() {
        this.gpxVisible = false;
        this.render();
    }
    
    /**
     * Load GPX file
     */
    async loadGPXFile(file) {
        if (!this.gpxManager) {
            this.initGPXRoutes();
        }
        if (!this.mapper) {
            throw new Error('Please apply geographic bounds before loading GPX files');
        }
        
        try {
            const gpxData = await this.gpxManager.loadGPXFile(file);
            
            // Auto-show GPX routes
            if (!this.gpxVisible) {
                this.gpxVisible = true;
            }
            
            this.render();
            return gpxData;
        } catch (error) {
            throw error;
        }
    }
    
    /**
     * Toggle specific route visibility
     */
    toggleGPXRoute(routeId) {
        if (this.gpxManager) {
            const visible = this.gpxManager.toggleRoute(routeId);
            this.render();
            return visible;
        }
        return false;
    }
    
    /**
     * Remove specific GPX route
     */
    removeGPXRoute(routeId) {
        if (this.gpxManager) {
            const removed = this.gpxManager.removeRoute(routeId);
            if (removed) {
                this.render();
            }
            return removed;
        }
        return false;
    }
    
    /**
     * Clear all GPX routes
     */
    clearAllGPXRoutes() {
        if (this.gpxManager) {
            this.gpxManager.clearAll();
            this.render();
        }
    }
    
    /**
     * Fit map to show all GPX routes
     */
    fitToGPXRoutes() {
        if (!this.gpxManager || !this.mapper) return;
        
        const bounds = this.gpxManager.getAllBounds();
        if (bounds) {
            // Update geographic bounds to show routes (keep current grid intervals)
            this.setGeographicBounds(
                bounds.minLat,
                bounds.maxLat,
                bounds.minLon,
                bounds.maxLon,
                { latInterval: this.latInterval, lonInterval: this.lonInterval }
            );
        }
    }
    
    /**
     * Get all GPX routes
     */
    getGPXRoutes() {
        return this.gpxManager ? this.gpxManager.routes : [];
    }

    /**
     * Initialize observed position manager
     */
    initObservedPosition() {
        if (!this.observedPositionManager && this.mapper) {
            this.observedPositionManager = new ObservedPositionManagerCanvas(this.mapper);
        }
        return this.observedPositionManager;
    }

    /**
     * Toggle observed position visibility
     */
    toggleObservedPosition() {
        if (!this.observedPositionManager) {
            this.initObservedPosition();
        }
        this.observedPositionVisible = !this.observedPositionVisible;
        this.render();
        return this.observedPositionVisible;
    }

    /**
     * Show observed positions
     */
    showObservedPositions() {
        if (!this.observedPositionManager) {
            this.initObservedPosition();
        }
        this.observedPositionVisible = true;
        this.render();
    }

    /**
     * Hide observed positions
     */
    hideObservedPositions() {
        this.observedPositionVisible = false;
        if (this.observedPositionManager) {
            this.observedPositionManager.cancelPlacement();
        }
        this.render();
    }

    /**
     * Start observed position placement
     */
    startObservedPositionPlacement() {
        if (!this.observedPositionManager) {
            this.initObservedPosition();
        }
        if (!this.observedPositionVisible) {
            this.observedPositionVisible = true;
        }
        this.observedPositionManager.startPlacement();
        this.render();
    }

    /**
     * Cancel observed position placement
     */
    cancelObservedPositionPlacement() {
        if (this.observedPositionManager) {
            this.observedPositionManager.cancelPlacement();
        }
        this.render();
    }

    /**
     * Delete selected observed position
     */
    deleteSelectedObservedPosition() {
        if (this.observedPositionManager) {
            const deleted = this.observedPositionManager.deleteSelected();
            if (deleted) {
                this.render();
            }
            return deleted;
        }
        return false;
    }

    /**
     * Clear all observed positions
     */
    clearAllObservedPositions() {
        if (this.observedPositionManager) {
            this.observedPositionManager.clearAll();
            this.render();
        }
    }

    /**
     * Get all observed positions
     */
    getObservedPositions() {
        return this.observedPositionManager ? this.observedPositionManager.getPositions() : [];
    }

    /**
     * Get selected observed position info
     */
    getSelectedObservedPositionInfo() {
        if (this.observedPositionManager) {
            return this.observedPositionManager.getSelectedInfo();
        }
        return null;
    }

    /**
     * Check if in observed position placement mode
     */
    isObservedPositionPlacementMode() {
        return this.observedPositionManager ? this.observedPositionManager.placementMode : false;
    }
}

// Make available globally
window.EnhancedGraticuleSystem = EnhancedGraticuleSystem;