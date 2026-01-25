/**
 * Nautical Navigation Divider (Chart Compass / Divider Tool)
 * Professional nautical chart divider for measuring and transferring distances
 * 
 * Features:
 * - Two-point placement with locked geodesic distance
 * - Drag to move entire divider while maintaining distance
 * - Rotate around center point
 * - Geodesic distance calculation in nautical miles
 * - Scales correctly with map zoom
 * - Traditional nautical appearance
 */

class NauticalDivider {
    constructor(pointA, pointB, mapper, projection) {
        this.pointA = pointA; // Geographic {lat, lon}
        this.pointB = pointB; // Geographic {lat, lon}
        this.mapper = mapper;
        this.projection = projection;
        
        // Calculate and lock the geodesic distance
        this.lockedDistance = this.calculateGeodesicDistance(pointA, pointB);
        
        // Calculate center point
        this.updateCenter();
        
        // Visual state
        this.isSelected = false;
        this.isDragging = false;
        this.isRotating = false;
        this.dragType = null; // 'center', 'pointA', 'pointB', 'rotate'
        
        // Handle sizes (in screen pixels)
        this.handleRadius = 6;
        this.centerHandleRadius = 8;
        this.rotateHandleDistance = 40; // pixels from center
        
        // Style
        this.style = {
            lineColor: 'rgba(255, 136, 0, 0.9)', // Nautical orange
            lineWidth: 2,
            selectedLineColor: 'rgba(255, 69, 0, 1)',
            selectedLineWidth: 3,
            handleColor: 'rgba(255, 136, 0, 0.95)',
            handleStroke: 'rgba(255, 255, 255, 0.9)',
            centerColor: 'rgba(0, 123, 255, 0.95)',
            rotateHandleColor: 'rgba(76, 175, 80, 0.95)'
        };
    }
    
    /**
     * Calculate geodesic distance between two points using Haversine formula
     * Returns distance in nautical miles
     */
    calculateGeodesicDistance(pointA, pointB) {
        const R = 3440.065; // Earth radius in nautical miles
        
        const lat1 = pointA.lat * Math.PI / 180;
        const lat2 = pointB.lat * Math.PI / 180;
        const deltaLat = (pointB.lat - pointA.lat) * Math.PI / 180;
        const deltaLon = (pointB.lon - pointA.lon) * Math.PI / 180;
        
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
    }
    
    /**
     * Calculate bearing from pointA to pointB
     * Returns bearing in degrees (0-360)
     */
    calculateBearing(fromPoint, toPoint) {
        const lat1 = fromPoint.lat * Math.PI / 180;
        const lat2 = toPoint.lat * Math.PI / 180;
        const deltaLon = (toPoint.lon - fromPoint.lon) * Math.PI / 180;
        
        const y = Math.sin(deltaLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
        
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360;
        
        return bearing;
    }
    
    /**
     * Calculate destination point given start point, bearing, and distance
     */
    calculateDestination(startPoint, bearing, distanceNM) {
        const R = 3440.065; // Earth radius in nautical miles
        const bearingRad = bearing * Math.PI / 180;
        const lat1 = startPoint.lat * Math.PI / 180;
        const lon1 = startPoint.lon * Math.PI / 180;
        
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(distanceNM / R) +
            Math.cos(lat1) * Math.sin(distanceNM / R) * Math.cos(bearingRad)
        );
        
        const lon2 = lon1 + Math.atan2(
            Math.sin(bearingRad) * Math.sin(distanceNM / R) * Math.cos(lat1),
            Math.cos(distanceNM / R) - Math.sin(lat1) * Math.sin(lat2)
        );
        
        return {
            lat: lat2 * 180 / Math.PI,
            lon: lon2 * 180 / Math.PI
        };
    }
    
    /**
     * Update center point (midpoint between A and B)
     */
    updateCenter() {
        this.center = {
            lat: (this.pointA.lat + this.pointB.lat) / 2,
            lon: (this.pointA.lon + this.pointB.lon) / 2
        };
    }
    
    /**
     * Move divider by delta in geographic coordinates
     */
    moveBy(deltaLat, deltaLon) {
        this.pointA.lat += deltaLat;
        this.pointA.lon += deltaLon;
        this.pointB.lat += deltaLat;
        this.pointB.lon += deltaLon;
        this.updateCenter();
    }
    
    /**
     * Rotate divider around center by angle in degrees
     */
    rotateBy(angleDelta) {
        const currentBearing = this.calculateBearing(this.center, this.pointB);
        const newBearing = (currentBearing + angleDelta) % 360;
        
        // Recalculate both points maintaining locked distance
        const halfDistance = this.lockedDistance / 2;
        
        this.pointA = this.calculateDestination(this.center, (newBearing + 180) % 360, halfDistance);
        this.pointB = this.calculateDestination(this.center, newBearing, halfDistance);
    }
    
    /**
     * Set rotation to specific angle (bearing from center to pointB)
     */
    setRotation(bearing) {
        const halfDistance = this.lockedDistance / 2;
        this.pointA = this.calculateDestination(this.center, (bearing + 180) % 360, halfDistance);
        this.pointB = this.calculateDestination(this.center, bearing, halfDistance);
    }
    
    /**
     * Hit test for interaction
     */
    hitTest(screenX, screenY) {
        const screenA = this.mapper.geographicToScreen(this.pointA.lat, this.pointA.lon);
        const screenB = this.mapper.geographicToScreen(this.pointB.lat, this.pointB.lon);
        const screenCenter = this.mapper.geographicToScreen(this.center.lat, this.center.lon);
        
        // Check rotate handle
        const bearing = this.calculateBearing(this.center, this.pointB);
        const rotateAngle = (bearing - 90) * Math.PI / 180; // Perpendicular to divider
        const rotateX = screenCenter.x + Math.cos(rotateAngle) * this.rotateHandleDistance;
        const rotateY = screenCenter.y + Math.sin(rotateAngle) * this.rotateHandleDistance;
        const distToRotate = Math.sqrt(Math.pow(screenX - rotateX, 2) + Math.pow(screenY - rotateY, 2));
        if (distToRotate < this.handleRadius + 2) {
            return 'rotate';
        }
        
        // Check center handle
        const distToCenter = Math.sqrt(
            Math.pow(screenX - screenCenter.x, 2) + Math.pow(screenY - screenCenter.y, 2)
        );
        if (distToCenter < this.centerHandleRadius + 2) {
            return 'center';
        }
        
        // Check point A handle
        const distToA = Math.sqrt(
            Math.pow(screenX - screenA.x, 2) + Math.pow(screenY - screenA.y, 2)
        );
        if (distToA < this.handleRadius + 2) {
            return 'pointA';
        }
        
        // Check point B handle
        const distToB = Math.sqrt(
            Math.pow(screenX - screenB.x, 2) + Math.pow(screenY - screenB.y, 2)
        );
        if (distToB < this.handleRadius + 2) {
            return 'pointB';
        }
        
        // Check line (within 5 pixels)
        const distToLine = this.pointToLineDistance(
            screenX, screenY,
            screenA.x, screenA.y,
            screenB.x, screenB.y
        );
        if (distToLine < 5) {
            return 'line';
        }
        
        return null;
    }
    
    /**
     * Calculate distance from point to line segment
     */
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Draw the divider on canvas
     */
    draw(ctx) {
        const screenA = this.mapper.geographicToScreen(this.pointA.lat, this.pointA.lon);
        const screenB = this.mapper.geographicToScreen(this.pointB.lat, this.pointB.lon);
        const screenCenter = this.mapper.geographicToScreen(this.center.lat, this.center.lon);
        
        ctx.save();
        
        // Draw main line
        ctx.strokeStyle = this.isSelected ? this.style.selectedLineColor : this.style.lineColor;
        ctx.lineWidth = this.isSelected ? this.style.selectedLineWidth : this.style.lineWidth;
        ctx.lineCap = 'round';
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.moveTo(screenA.x, screenA.y);
        ctx.lineTo(screenB.x, screenB.y);
        ctx.stroke();
        
        // Draw handles when selected
        if (this.isSelected) {
            // Point A handle
            this.drawHandle(ctx, screenA.x, screenA.y, this.handleRadius, this.style.handleColor);
            
            // Point B handle
            this.drawHandle(ctx, screenB.x, screenB.y, this.handleRadius, this.style.handleColor);
            
            // Center handle (larger, different color)
            this.drawHandle(ctx, screenCenter.x, screenCenter.y, this.centerHandleRadius, this.style.centerColor);
            
            // Rotation handle (perpendicular to divider)
            const bearing = this.calculateBearing(this.center, this.pointB);
            const rotateAngle = (bearing - 90) * Math.PI / 180;
            const rotateX = screenCenter.x + Math.cos(rotateAngle) * this.rotateHandleDistance;
            const rotateY = screenCenter.y + Math.sin(rotateAngle) * this.rotateHandleDistance;
            
            // Draw line to rotate handle
            ctx.strokeStyle = 'rgba(76, 175, 80, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(screenCenter.x, screenCenter.y);
            ctx.lineTo(rotateX, rotateY);
            ctx.stroke();
            
            // Draw rotate handle
            this.drawHandle(ctx, rotateX, rotateY, this.handleRadius, this.style.rotateHandleColor);
            
            // Draw distance label
            this.drawLabel(ctx, screenCenter.x, screenCenter.y);
        }
        
        ctx.restore();
    }
    
    /**
     * Draw a handle (circular with stroke)
     */
    drawHandle(ctx, x, y, radius, fillColor) {
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = this.style.handleStroke;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    
    /**
     * Draw distance label
     */
    drawLabel(ctx, x, y) {
        const text = `${this.lockedDistance.toFixed(2)} NM`;
        
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        const metrics = ctx.measureText(text);
        const padding = 6;
        const width = metrics.width + padding * 2;
        const height = 20;
        
        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(x - width / 2, y - height - 10, width, height);
        
        // Border
        ctx.strokeStyle = this.style.lineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(x - width / 2, y - height - 10, width, height);
        
        // Text
        ctx.fillStyle = '#333';
        ctx.fillText(text, x, y - 12);
    }
    
    /**
     * Get cursor style for handle type
     */
    getCursor(handleType) {
        switch (handleType) {
            case 'center':
            case 'line':
                return 'move';
            case 'pointA':
            case 'pointB':
                return 'grab';
            case 'rotate':
                return 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'><path d=\'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z\' fill=\'%234CAF50\'/></svg>") 12 12, auto';
            default:
                return 'default';
        }
    }
}

/**
 * Nautical Divider Manager
 * Manages multiple dividers and handles user interaction
 */
class NauticalDividerManager {
    constructor(mapper, projection) {
        this.mapper = mapper;
        this.projection = projection;
        this.dividers = [];
        this.selectedDivider = null;
        this.placementMode = false;
        this.placementPointA = null;
        
        // Interaction state
        this.isDragging = false;
        this.dragStartGeo = null;
        this.dragStartRotation = null;
        this.lastMouseScreen = null;
    }
    
    /**
     * Enter placement mode (user will click two points)
     */
    startPlacement() {
        this.placementMode = true;
        this.placementPointA = null;
        this.selectedDivider = null;
    }
    
    /**
     * Cancel placement mode
     */
    cancelPlacement() {
        this.placementMode = false;
        this.placementPointA = null;
    }
    
    /**
     * Handle mouse down
     */
    handleMouseDown(screenX, screenY) {
        if (this.placementMode) {
            // Placing divider points
            const geo = this.mapper.screenToGeographic(screenX, screenY);
            
            if (!this.placementPointA) {
                // First point
                this.placementPointA = geo;
                return true;
            } else {
                // Second point - create divider
                const divider = new NauticalDivider(
                    this.placementPointA,
                    geo,
                    this.mapper,
                    this.projection
                );
                this.dividers.push(divider);
                this.selectedDivider = divider;
                divider.isSelected = true;
                
                // Exit placement mode
                this.placementMode = false;
                this.placementPointA = null;
                return true;
            }
        }
        
        // Check if clicking on a divider
        for (let i = this.dividers.length - 1; i >= 0; i--) {
            const divider = this.dividers[i];
            const handleType = divider.hitTest(screenX, screenY);
            
            if (handleType) {
                // Deselect all others
                this.dividers.forEach(d => d.isSelected = false);
                
                // Select this one
                divider.isSelected = true;
                this.selectedDivider = divider;
                
                // Start dragging
                this.isDragging = true;
                divider.isDragging = true;
                divider.dragType = handleType;
                
                const geo = this.mapper.screenToGeographic(screenX, screenY);
                this.dragStartGeo = {...geo};
                this.lastMouseScreen = {x: screenX, y: screenY};
                
                if (handleType === 'rotate') {
                    divider.isRotating = true;
                    this.dragStartRotation = divider.calculateBearing(divider.center, divider.pointB);
                }
                
                return true;
            }
        }
        
        // Click on empty space - deselect all
        this.dividers.forEach(d => d.isSelected = false);
        this.selectedDivider = null;
        
        return false;
    }
    
    /**
     * Handle mouse move
     */
    handleMouseMove(screenX, screenY) {
        if (this.isDragging && this.selectedDivider) {
            const divider = this.selectedDivider;
            const currentGeo = this.mapper.screenToGeographic(screenX, screenY);
            
            if (divider.dragType === 'center' || divider.dragType === 'line') {
                // Move entire divider
                const deltaLat = currentGeo.lat - this.dragStartGeo.lat;
                const deltaLon = currentGeo.lon - this.dragStartGeo.lon;
                
                divider.moveBy(deltaLat, deltaLon);
                
                this.dragStartGeo = currentGeo;
            } else if (divider.dragType === 'rotate') {
                // Rotate around center
                const center = this.mapper.geographicToScreen(divider.center.lat, divider.center.lon);
                const startAngle = Math.atan2(
                    this.lastMouseScreen.y - center.y,
                    this.lastMouseScreen.x - center.x
                ) * 180 / Math.PI;
                const currentAngle = Math.atan2(
                    screenY - center.y,
                    screenX - center.x
                ) * 180 / Math.PI;
                
                let angleDelta = currentAngle - startAngle;
                divider.rotateBy(angleDelta);
                
                this.lastMouseScreen = {x: screenX, y: screenY};
            } else if (divider.dragType === 'pointA' || divider.dragType === 'pointB') {
                // Move one point while maintaining distance
                const bearing = divider.calculateBearing(
                    divider.dragType === 'pointA' ? divider.pointB : divider.pointA,
                    currentGeo
                );
                
                const newPoint = divider.calculateDestination(
                    divider.dragType === 'pointA' ? divider.pointB : divider.pointA,
                    bearing,
                    divider.lockedDistance
                );
                
                if (divider.dragType === 'pointA') {
                    divider.pointA = newPoint;
                } else {
                    divider.pointB = newPoint;
                }
                
                divider.updateCenter();
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Handle mouse up
     */
    handleMouseUp() {
        if (this.isDragging && this.selectedDivider) {
            this.selectedDivider.isDragging = false;
            this.selectedDivider.isRotating = false;
            this.selectedDivider.dragType = null;
            this.isDragging = false;
            this.dragStartGeo = null;
            this.dragStartRotation = null;
            this.lastMouseScreen = null;
            return true;
        }
        return false;
    }
    
    /**
     * Update cursor based on hover
     */
    updateCursor(screenX, screenY) {
        if (this.placementMode) {
            return 'crosshair';
        }
        
        if (this.isDragging && this.selectedDivider) {
            return this.selectedDivider.getCursor(this.selectedDivider.dragType);
        }
        
        // Check hover over dividers
        for (const divider of this.dividers) {
            const handleType = divider.hitTest(screenX, screenY);
            if (handleType) {
                return divider.getCursor(handleType);
            }
        }
        
        return 'default';
    }
    
    /**
     * Draw all dividers
     */
    drawAll(ctx) {
        // Draw unselected first
        for (const divider of this.dividers) {
            if (!divider.isSelected) {
                divider.draw(ctx);
            }
        }
        
        // Draw selected on top
        for (const divider of this.dividers) {
            if (divider.isSelected) {
                divider.draw(ctx);
            }
        }
        
        // Draw placement preview
        if (this.placementMode && this.placementPointA && this.lastMouseScreen) {
            const screenA = this.mapper.geographicToScreen(
                this.placementPointA.lat,
                this.placementPointA.lon
            );
            
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 136, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(screenA.x, screenA.y);
            ctx.lineTo(this.lastMouseScreen.x, this.lastMouseScreen.y);
            ctx.stroke();
            
            // Draw point A
            ctx.fillStyle = 'rgba(255, 136, 0, 0.8)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(screenA.x, screenA.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.restore();
        }
    }
    
    /**
     * Store last mouse position for preview
     */
    setPreviewMouse(screenX, screenY) {
        if (this.placementMode) {
            this.lastMouseScreen = {x: screenX, y: screenY};
        }
    }
    
    /**
     * Delete selected divider
     */
    deleteSelected() {
        if (this.selectedDivider) {
            const index = this.dividers.indexOf(this.selectedDivider);
            if (index > -1) {
                this.dividers.splice(index, 1);
                this.selectedDivider = null;
                return true;
            }
        }
        return false;
    }
    
    /**
     * Clear all dividers
     */
    clearAll() {
        this.dividers = [];
        this.selectedDivider = null;
        this.placementMode = false;
        this.placementPointA = null;
    }
    
    /**
     * Get selected divider info
     */
    getSelectedInfo() {
        if (this.selectedDivider) {
            return {
                distance: this.selectedDivider.lockedDistance,
                bearing: this.selectedDivider.calculateBearing(
                    this.selectedDivider.pointA,
                    this.selectedDivider.pointB
                ),
                pointA: {...this.selectedDivider.pointA},
                pointB: {...this.selectedDivider.pointB}
            };
        }
        return null;
    }
}

// Make available globally
window.NauticalDivider = NauticalDivider;
window.NauticalDividerManager = NauticalDividerManager;