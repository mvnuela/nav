/**
 * Graticule Drawing and Export Methods
 * Extends EnhancedGraticuleSystem prototype with drawing, labeling, and export functionality
 */

/**
 * Colour of the graticule lines, shared by the canvas renderer and the SVG
 * export so an exported chart matches what was on screen. The canvas and the
 * export previously hardcoded different colours and had drifted apart.
 * The coordinate labels are styled separately and are deliberately not this.
 */
const GRATICULE_LINE_COLOR = '#808000';

EnhancedGraticuleSystem.prototype.drawGraticule = function() {
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
    this.ctx.strokeStyle = GRATICULE_LINE_COLOR;
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([5, 5]);
    this.ctx.globalAlpha = 0.7;

    // Draw latitude lines (parallels) - horizontal lines
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
    }

    // Draw longitude lines (meridians) - vertical lines
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
    }

    this.ctx.restore();
};

EnhancedGraticuleSystem.prototype.exportSVG = function() {
    if (!this.mapper || !this.geoBounds) return null;

    // Validate intervals
    if (!this.latInterval || this.latInterval <= 0 || !this.lonInterval || this.lonInterval <= 0) {
        console.error('Invalid grid intervals for SVG export');
        return null;
    }

    // Build a composite raster of the full canvas (base image + graticule +
    // dividers + GPX + observed positions + geometry + courses, excluding
    // nautical triangles) and embed it inside the SVG as an <image> so the
    // SVG export matches the PNG export content.
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = this.canvas.width;
    compositeCanvas.height = this.canvas.height;
    const compositeCtx = compositeCanvas.getContext('2d');

    if (this.uploadedImage) {
        compositeCtx.drawImage(this.uploadedImage, 0, 0);
    }

    const originalCtx = this.ctx;
    this.ctx = compositeCtx;
    try {
        this.drawGraticule();
        if (this.dividerManager) this.dividerManager.drawAll(compositeCtx);
        if (this.gpxManager) this.gpxManager.drawAll(compositeCtx, this.mapper);
        if (this.observedPositionManager) this.observedPositionManager.drawAll(compositeCtx);
        if (this.drPositionManager) this.drPositionManager.drawAll(compositeCtx);
        if (this.geometryManager) this.geometryManager.drawAll(compositeCtx);
        if (typeof this.drawCourses === 'function') this.drawCourses();
    } finally {
        this.ctx = originalCtx;
    }

    const dataUrl = compositeCanvas.toDataURL('image/png');

    const width = this.mapRegion.width;
    const height = this.mapRegion.height;
    const imgX = -this.mapRegion.x;
    const imgY = -this.mapRegion.y;
    const imgW = this.canvas.width;
    const imgH = this.canvas.height;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <image x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" xlink:href="${dataUrl}"/>
</svg>`;
};

// Legacy vector-only graticule SVG, kept for callers that need it specifically.
EnhancedGraticuleSystem.prototype.exportGraticuleSVG = function() {
    if (!this.mapper || !this.geoBounds) return null;

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
        .graticule-major { stroke: ${GRATICULE_LINE_COLOR}; stroke-width: 2.5; opacity: 0.9; }
        .graticule-minor { stroke: ${GRATICULE_LINE_COLOR}; stroke-width: 1.5; stroke-dasharray: 5,5; opacity: 0.7; }
        .graticule-medium { stroke: ${GRATICULE_LINE_COLOR}; stroke-width: 2; opacity: 0.8; }
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
};

EnhancedGraticuleSystem.prototype.exportHighResPNG = function(scaleFactor = 2) {
    if (!this.uploadedImage) return null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width * scaleFactor;
    tempCanvas.height = this.canvas.height * scaleFactor;

    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.scale(scaleFactor, scaleFactor);

    tempCtx.drawImage(this.uploadedImage, 0, 0);

    const originalCtx = this.ctx;
    this.ctx = tempCtx;

    try {
        if (this.mapper) {
            this.drawGraticule();
        }
        if (this.dividerManager) {
            this.dividerManager.drawAll(tempCtx);
        }
        if (this.gpxManager && this.mapper) {
            this.gpxManager.drawAll(tempCtx, this.mapper);
        }
        if (this.observedPositionManager) {
            this.observedPositionManager.drawAll(tempCtx);
        }
        if (this.drPositionManager) {
            this.drPositionManager.drawAll(tempCtx);
        }
        if (this.geometryManager) {
            this.geometryManager.drawAll(tempCtx);
        }
        if (typeof this.drawCourses === 'function') {
            this.drawCourses();
        }
        // Nautical triangles deliberately excluded from export.
    } finally {
        this.ctx = originalCtx;
    }

    return tempCanvas.toDataURL('image/png');
};