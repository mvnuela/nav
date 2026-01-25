/**
 * Nautical Navigation Triangles Component
 * Professional maritime navigation triangles for course plotting
 * Features:
 * - Right isosceles triangles (45°-45°-90°)
 * - Index line at hypotenuse midpoint for reading courses
 * - Degree scale (0°-180°) with tick marks
 * - Independent drag and rotation
 * - Semi-transparent for map visibility
 */

class NauticalTriangle {
    /**
     * Create a nautical navigation triangle
     * @param {string} id - Unique identifier
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} size - Triangle leg length in pixels
     * @param {string} name - Display name (e.g., "Port", "Starboard")
     */
    constructor(id, x, y, size = 200, name = "Triangle") {
        this.id = id;
        this.name = name;
        this.size = size;
        
        // Position (center of triangle)
        this.x = x;
        this.y = y;
        
        // Rotation angle in degrees (0° = north up)
        this.rotation = 0;
        
        // Interaction state
        this.isDragging = false;
        this.isRotating = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.rotationStartAngle = 0;
        
        // Visual properties
        this.opacity = 0.85;
        this.fillColor = 'rgba(255, 255, 255, 0.7)';
        this.strokeColor = '#000000';
        this.indexLineColor = '#FF0000';
        this.scaleColor = '#000000';
        
        // Calculate geometry
        this.updateGeometry();
    }
    
    /**
     * Calculate triangle geometry (vertices relative to center)
     * Right isosceles triangle: two equal legs at 90°, hypotenuse at 45°
     */
    updateGeometry() {
        // For a right isosceles triangle with legs of length 'size':
        // - Right angle vertex at origin
        // - Two legs extend along X and Y axes
        // - Hypotenuse connects the ends of the legs
        
        const halfSize = this.size / 2;
        
        // Vertices relative to center (before rotation)
        // Right angle at bottom-left, hypotenuse from top-left to bottom-right
        this.vertices = [
            { x: -halfSize, y: halfSize },      // Bottom-left (right angle)
            { x: -halfSize, y: -halfSize },     // Top-left
            { x: halfSize, y: halfSize }        // Bottom-right
        ];
        
        // Hypotenuse midpoint (for index line)
        this.hypotenuseMidpoint = {
            x: 0,  // Midpoint between top-left and bottom-right
            y: 0
        };
        
        // Index line extends perpendicular to hypotenuse
        // Hypotenuse angle is 45° (or -45° depending on orientation)
        // Perpendicular is at 45° + 90° = 135°
        const indexLineLength = this.size * 0.15;
        const hypotenuseAngle = -45 * Math.PI / 180; // Hypotenuse slope
        const perpAngle = hypotenuseAngle + Math.PI / 2;
        
        this.indexLineStart = {
            x: this.hypotenuseMidpoint.x - Math.cos(perpAngle) * indexLineLength,
            y: this.hypotenuseMidpoint.y - Math.sin(perpAngle) * indexLineLength
        };
        this.indexLineEnd = {
            x: this.hypotenuseMidpoint.x + Math.cos(perpAngle) * indexLineLength,
            y: this.hypotenuseMidpoint.y + Math.sin(perpAngle) * indexLineLength
        };
    }
    
    /**
     * Transform a point by rotation and translation
     */
    transformPoint(px, py) {
        const rad = this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        return {
            x: this.x + px * cos - py * sin,
            y: this.y + px * sin + py * cos
        };
    }
    
    /**
     * Draw the triangle on canvas
     */
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        
        // Transform to triangle position and rotation
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        
        // Draw triangle body
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        ctx.lineTo(this.vertices[1].x, this.vertices[1].y);
        ctx.lineTo(this.vertices[2].x, this.vertices[2].y);
        ctx.closePath();
        
        ctx.fillStyle = this.fillColor;
        ctx.fill();
        
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw index line (high contrast red line)
        ctx.beginPath();
        ctx.moveTo(this.indexLineStart.x, this.indexLineStart.y);
        ctx.lineTo(this.indexLineEnd.x, this.indexLineEnd.y);
        ctx.strokeStyle = this.indexLineColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw degree scale along hypotenuse
        this.drawDegreeScale(ctx);
        
        // Draw rotation handle (small circle at center)
        if (this.isRotating) {
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Draw name label
        this.drawLabel(ctx);
    }
    
    /**
     * Draw degree scale (0°-180°) along hypotenuse
     */
    drawDegreeScale(ctx) {
        const v1 = this.vertices[1]; // Top-left
        const v2 = this.vertices[2]; // Bottom-right
        
        // Draw tick marks every 1°, longer at 5° and 10° intervals
        for (let deg = 0; deg <= 180; deg++) {
            const t = deg / 180; // Position along hypotenuse (0 to 1)
            const px = v1.x + (v2.x - v1.x) * t;
            const py = v1.y + (v2.y - v1.y) * t;
            
            // Determine tick length
            let tickLength;
            if (deg % 10 === 0) {
                tickLength = 12; // Long tick every 10°
            } else if (deg % 5 === 0) {
                tickLength = 8;  // Medium tick every 5°
            } else {
                tickLength = 4;  // Short tick every 1°
            }
            
            // Calculate tick direction (perpendicular to hypotenuse, pointing inward)
            const hypAngle = Math.atan2(v2.y - v1.y, v2.x - v1.x);
            const perpAngle = hypAngle + Math.PI / 2;
            
            const tx1 = px;
            const ty1 = py;
            const tx2 = px + Math.cos(perpAngle) * tickLength;
            const ty2 = py + Math.sin(perpAngle) * tickLength;
            
            ctx.beginPath();
            ctx.moveTo(tx1, ty1);
            ctx.lineTo(tx2, ty2);
            ctx.strokeStyle = this.scaleColor;
            ctx.lineWidth = deg % 10 === 0 ? 2 : 1;
            ctx.stroke();
            
            // Draw numeric labels every 10°
            if (deg % 10 === 0) {
                ctx.save();
                ctx.font = 'bold 11px monospace';
                ctx.fillStyle = this.scaleColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Position label slightly away from tick
                const labelDist = 18;
                const lx = px + Math.cos(perpAngle) * labelDist;
                const ly = py + Math.sin(perpAngle) * labelDist;
                
                // Rotate text to be readable
                ctx.translate(lx, ly);
                ctx.rotate(hypAngle);
                ctx.fillText(deg.toString(), 0, 0);
                
                ctx.restore();
            }
        }
    }
    
    /**
     * Draw triangle name label
     */
    drawLabel(ctx) {
        ctx.save();
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Position label below triangle
        const labelY = this.y + this.size / 2 + 25;
        
        ctx.strokeText(this.name, this.x, labelY);
        ctx.fillText(this.name, this.x, labelY);
        
        // Show rotation angle
        const angleText = `${Math.round(this.rotation)}°`;
        ctx.font = '12px monospace';
        ctx.strokeText(angleText, this.x, labelY + 18);
        ctx.fillText(angleText, this.x, labelY + 18);
        
        ctx.restore();
    }
    
    /**
     * Check if a point is inside the triangle
     */
    containsPoint(px, py) {
        // Transform point to triangle's local coordinate system
        const dx = px - this.x;
        const dy = py - this.y;
        const rad = -this.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        
        // Check if point is inside triangle using barycentric coordinates
        const v0 = this.vertices[0];
        const v1 = this.vertices[1];
        const v2 = this.vertices[2];
        
        const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);
        const a = ((v1.y - v2.y) * (localX - v2.x) + (v2.x - v1.x) * (localY - v2.y)) / denom;
        const b = ((v2.y - v0.y) * (localX - v2.x) + (v0.x - v2.x) * (localY - v2.y)) / denom;
        const c = 1 - a - b;
        
        return a >= 0 && b >= 0 && c >= 0;
    }
    
    /**
     * Check if a point is near the center (for rotation)
     */
    isNearCenter(px, py, threshold = 20) {
        const dx = px - this.x;
        const dy = py - this.y;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
    }
    
    /**
     * Start dragging the triangle
     */
    startDrag(px, py) {
        this.isDragging = true;
        this.dragStartX = px - this.x;
        this.dragStartY = py - this.y;
    }
    
    /**
     * Update drag position
     */
    updateDrag(px, py) {
        if (this.isDragging) {
            this.x = px - this.dragStartX;
            this.y = py - this.dragStartY;
        }
    }
    
    /**
     * Stop dragging
     */
    stopDrag() {
        this.isDragging = false;
    }
    
    /**
     * Start rotating the triangle
     */
    startRotation(px, py) {
        this.isRotating = true;
        this.rotationStartAngle = Math.atan2(py - this.y, px - this.x) * 180 / Math.PI;
    }
    
    /**
     * Update rotation angle
     */
    updateRotation(px, py) {
        if (this.isRotating) {
            const currentAngle = Math.atan2(py - this.y, px - this.x) * 180 / Math.PI;
            const deltaAngle = currentAngle - this.rotationStartAngle;
            this.rotation += deltaAngle;
            
            // Normalize to 0-360
            while (this.rotation < 0) this.rotation += 360;
            while (this.rotation >= 360) this.rotation -= 360;
            
            this.rotationStartAngle = currentAngle;
        }
    }
    
    /**
     * Stop rotating
     */
    stopRotation() {
        this.isRotating = false;
    }
    
    /**
     * Get current rotation angle for reading courses/bearings
     */
    getRotationAngle() {
        return this.rotation;
    }
}

/**
 * Manager for multiple nautical triangles
 */
class NauticalTriangleManager {
    constructor() {
        this.triangles = [];
        this.activeTriangle = null;
    }
    
    /**
     * Add a triangle
     */
    addTriangle(triangle) {
        this.triangles.push(triangle);
    }
    
    /**
     * Create two standard triangles (port and starboard style)
     */
    createStandardPair(canvasWidth, canvasHeight, triangleSize = 200) {
        // Port triangle (left side)
        const portX = canvasWidth * 0.3;
        const portY = canvasHeight * 0.5;
        const portTriangle = new NauticalTriangle('port', portX, portY, triangleSize, 'Port Triangle');
        
        // Starboard triangle (right side)
        const starboardX = canvasWidth * 0.7;
        const starboardY = canvasHeight * 0.5;
        const starboardTriangle = new NauticalTriangle('starboard', starboardX, starboardY, triangleSize, 'Starboard Triangle');
        
        this.addTriangle(portTriangle);
        this.addTriangle(starboardTriangle);
        
        return { port: portTriangle, starboard: starboardTriangle };
    }
    
    /**
     * Draw all triangles
     */
    drawAll(ctx) {
        // Draw inactive triangles first
        for (const triangle of this.triangles) {
            if (triangle !== this.activeTriangle) {
                triangle.draw(ctx);
            }
        }
        
        // Draw active triangle last (on top)
        if (this.activeTriangle) {
            this.activeTriangle.draw(ctx);
        }
    }
    
    /**
     * Handle mouse down event
     */
    handleMouseDown(px, py, isRightClick = false) {
        // Check triangles in reverse order (top to bottom)
        for (let i = this.triangles.length - 1; i >= 0; i--) {
            const triangle = this.triangles[i];
            
            // Check if near center for rotation
            if (triangle.isNearCenter(px, py)) {
                this.activeTriangle = triangle;
                triangle.startRotation(px, py);
                return true;
            }
            
            // Check if inside triangle for dragging
            if (triangle.containsPoint(px, py)) {
                this.activeTriangle = triangle;
                triangle.startDrag(px, py);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Handle mouse move event
     */
    handleMouseMove(px, py) {
        if (this.activeTriangle) {
            if (this.activeTriangle.isRotating) {
                this.activeTriangle.updateRotation(px, py);
                return true;
            } else if (this.activeTriangle.isDragging) {
                this.activeTriangle.updateDrag(px, py);
                return true;
            }
        }
        
        // Update cursor based on hover
        return this.updateCursor(px, py);
    }
    
    /**
     * Handle mouse up event
     */
    handleMouseUp() {
        if (this.activeTriangle) {
            this.activeTriangle.stopDrag();
            this.activeTriangle.stopRotation();
            this.activeTriangle = null;
            return true;
        }
        return false;
    }
    
    /**
     * Update cursor based on hover position
     */
    updateCursor(px, py) {
        for (const triangle of this.triangles) {
            if (triangle.isNearCenter(px, py)) {
                return 'crosshair'; // Rotation cursor
            }
            if (triangle.containsPoint(px, py)) {
                return 'move'; // Drag cursor
            }
        }
        return 'default';
    }
    
    /**
     * Get all triangle rotation angles
     */
    getRotationAngles() {
        const angles = {};
        for (const triangle of this.triangles) {
            angles[triangle.id] = triangle.getRotationAngle();
        }
        return angles;
    }
}

// Make classes available globally
window.NauticalTriangle = NauticalTriangle;
window.NauticalTriangleManager = NauticalTriangleManager;