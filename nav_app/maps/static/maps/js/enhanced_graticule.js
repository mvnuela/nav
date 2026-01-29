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
        this.latInterval = 0.5; // degrees
        this.lonInterval = 0.5; // degrees
        this.showMinorGrid = false;
        
        // Nautical triangles
        this.triangleManager = null;
        this.trianglesVisible = false;
        
        // Nautical divider
        this.dividerManager = null;
        this.dividerVisible = false;
        
        // GPX routes
        this.gpxManager = null;
        this.gpxVisible = false;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
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

    setGeographicBounds(minLat, maxLat, minLon, maxLon) {
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

    setMode(mode) {
        this.mode = mode;
        this.render();
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Account for CSS scaling
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
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
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
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
    }

    drawGraticule() {
        if (!this.mapper || !this.geoBounds) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = '#0078A8';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([5, 5]);
        this.ctx.globalAlpha = 0.7;
        
        // Draw latitude lines (parallels)
        const startLat = Math.floor(this.geoBounds.minLat / this.latInterval) * this.latInterval;
        const endLat = Math.ceil(this.geoBounds.maxLat / this.latInterval) * this.latInterval;
        
        for (let lat = startLat; lat <= endLat; lat += this.latInterval) {
            if (lat < this.geoBounds.minLat || lat > this.geoBounds.maxLat) continue;
            
            const isWholeDegree = Math.abs(lat - Math.round(lat)) < 0.0001;
            
            // Draw line
            const start = this.mapper.geographicToScreen(lat, this.geoBounds.minLon);
            const end = this.mapper.geographicToScreen(lat, this.geoBounds.maxLon);
            
            if (isWholeDegree) {
                this.ctx.save();
                this.ctx.lineWidth = 2;
                this.ctx.globalAlpha = 0.8;
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.stroke();
            
            if (isWholeDegree) {
                this.ctx.restore();
            }
            
            // Draw label
            this.drawLatitudeLabel(lat, start.x + 10, start.y, isWholeDegree);
        }
        
        // Draw longitude lines (meridians)
        const startLon = Math.floor(this.geoBounds.minLon / this.lonInterval) * this.lonInterval;
        const endLon = Math.ceil(this.geoBounds.maxLon / this.lonInterval) * this.lonInterval;
        
        for (let lon = startLon; lon <= endLon; lon += this.lonInterval) {
            if (lon < this.geoBounds.minLon || lon > this.geoBounds.maxLon) continue;
            
            const isWholeDegree = Math.abs(lon - Math.round(lon)) < 0.0001;
            
            // Draw line
            const start = this.mapper.geographicToScreen(this.geoBounds.maxLat, lon);
            const end = this.mapper.geographicToScreen(this.geoBounds.minLat, lon);
            
            if (isWholeDegree) {
                this.ctx.save();
                this.ctx.lineWidth = 2;
                this.ctx.globalAlpha = 0.8;
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.stroke();
            
            if (isWholeDegree) {
                this.ctx.restore();
            }
            
            // Draw label
            this.drawLongitudeLabel(lon, start.x, start.y + 20, isWholeDegree);
        }
        
        this.ctx.restore();
    }

    drawLatitudeLabel(lat, x, y, isWholeDegree) {
        let label;
        if (isWholeDegree) {
            const degrees = Math.round(Math.abs(lat));
            const direction = lat >= 0 ? 'N' : 'S';
            label = `${degrees}°${direction}`;
        } else {
            const abs = Math.abs(lat);
            const degrees = Math.floor(abs);
            const minutes = Math.round((abs - degrees) * 60);
            label = `${minutes}'`;
        }
        
        this.ctx.save();
        const labelWidth = this.ctx.measureText(label).width + 8;
        
this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.fillRect(x - 2, y - 12, labelWidth, 24);
        
        this.ctx.strokeStyle = '#0078A8';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - 2, y - 12, labelWidth, 24);
        
        this.ctx.fillStyle = '#0078A8';
        this.ctx.font = isWholeDegree ? 'bold 13px monospace' : 'normal 11px monospace';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, x + 2, y);
        this.ctx.restore();
    }

    drawLongitudeLabel(lon, x, y, isWholeDegree) {
        let label;
        if (isWholeDegree) {
            const degrees = Math.round(Math.abs(lon));
            const direction = lon >= 0 ? 'E' : 'W';
            label = `${degrees.toString().padStart(3, '0')}°${direction}`;
        } else {
            const abs = Math.abs(lon);
            const degrees = Math.floor(abs);
            const minutes = Math.round((abs - degrees) * 60);
            label = `${minutes}'`;
        }
        
        this.ctx.save();
        const width = this.ctx.measureText(label).width + 10;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        this.ctx.fillRect(x - width/2, y - 2, width, 24);
        
        this.ctx.strokeStyle = '#0078A8';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - width/2, y - 2, width, 24);
        
        this.ctx.fillStyle = '#0078A8';
        this.ctx.font = isWholeDegree ? 'bold 13px monospace' : 'normal 11px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(label, x, y + 2);
        this.ctx.restore();
    }

    exportSVG() {
        if (!this.mapper) return null;
        
        const width = this.mapRegion.width;
        const height = this.mapRegion.height;
        
        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
    <style>
        .graticule-major { stroke: #0078A8; stroke-width: 2; opacity: 0.8; }
        .graticule-minor { stroke: #0078A8; stroke-width: 1; stroke-dasharray: 5,5; opacity: 0.7; }
    </style>
</defs>
<g id="graticule">
`;
        
        const startLat = Math.floor(this.geoBounds.minLat / this.latInterval) * this.latInterval;
        const endLat = Math.ceil(this.geoBounds.maxLat / this.latInterval) * this.latInterval;
        const startLon = Math.floor(this.geoBounds.minLon / this.lonInterval) * this.lonInterval;
        const endLon = Math.ceil(this.geoBounds.maxLon / this.lonInterval) * this.lonInterval;
        
        // Parallels
        for (let lat = startLat; lat <= endLat; lat += this.latInterval) {
            if (lat < this.geoBounds.minLat || lat > this.geoBounds.maxLat) continue;
            
            const start = this.mapper.geographicToScreen(lat, this.geoBounds.minLon);
            const end = this.mapper.geographicToScreen(lat, this.geoBounds.maxLon);
            const isWholeDegree = Math.abs(lat - Math.round(lat)) < 0.0001;
            
            const x1 = start.x - this.mapRegion.x;
            const y1 = start.y - this.mapRegion.y;
            const x2 = end.x - this.mapRegion.x;
            const y2 = end.y - this.mapRegion.y;
            
            svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="graticule-${isWholeDegree ? 'major' : 'minor'}"/>\n`;
        }
        
        // Meridians
        for (let lon = startLon; lon <= endLon; lon += this.lonInterval) {
            if (lon < this.geoBounds.minLon || lon > this.geoBounds.maxLon) continue;
            
            const start = this.mapper.geographicToScreen(this.geoBounds.maxLat, lon);
            const end = this.mapper.geographicToScreen(this.geoBounds.minLat, lon);
            const isWholeDegree = Math.abs(lon - Math.round(lon)) < 0.0001;
            
            const x1 = start.x - this.mapRegion.x;
            const y1 = start.y - this.mapRegion.y;
            const x2 = end.x - this.mapRegion.x;
            const y2 = end.y - this.mapRegion.y;
            
            svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="graticule-${isWholeDegree ? 'major' : 'minor'}"/>\n`;
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
            // Update geographic bounds to show routes
            this.setGeographicBounds(
                bounds.minLat,
                bounds.maxLat,
                bounds.minLon,
                bounds.maxLon
            );
        }
    }
    
    /**
     * Get all GPX routes
     */
    getGPXRoutes() {
        return this.gpxManager ? this.gpxManager.routes : [];
    }
}

// Make available globally
window.EnhancedGraticuleSystem = EnhancedGraticuleSystem;