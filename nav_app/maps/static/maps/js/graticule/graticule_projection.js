/**
 * Graticule Projection Classes
 * MercatorProjection, MapRegion, and CoordinateMapper
 * Used by EnhancedGraticuleSystem
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

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {boolean} isActive
     * @param {number} imageWidth   chart width in its own pixels
     * @param {number} imageHeight  chart height in its own pixels
     *
     * The chart's extent is passed in rather than read off ctx.canvas: the
     * canvas is the panel now, not the chart, so shading to the canvas edge
     * would dim the empty panel and leave part of the chart lit.
     */
    draw(ctx, isActive = false, imageWidth = 0, imageHeight = 0) {
        ctx.save();

        // Draw region border
        ctx.strokeStyle = isActive ? '#FF5722' : '#0078A8';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Draw semi-transparent overlay outside region
        if (isActive) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, 0, imageWidth, this.y); // Top
            ctx.fillRect(0, this.y, this.x, this.height); // Left
            ctx.fillRect(this.x + this.width, this.y,
                        imageWidth - this.x - this.width, this.height); // Right
            ctx.fillRect(0, this.y + this.height,
                        imageWidth, imageHeight - this.y - this.height); // Bottom
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
