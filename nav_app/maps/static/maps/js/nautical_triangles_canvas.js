/**
 * Nautical Plotting Triangle Component - Canvas Version
 * Professional maritime navigation plotting triangle for course plotting
 * Designed for use with canvas-based map systems (enhanced graticule)
 *
 * Technical Specifications (based on standard nautical plotting triangle):
 * - Isosceles right triangle (45°-45°-90°)
 * - Hypotenuse at TOP (horizontal), 90° vertex pointing DOWN
 * - Reference point O = 90° vertex (bottom point) = center of protractor scale
 * - Semicircular protractor scale centered at hypotenuse, opening downward
 * - Two concentric scales: 0°-180° (outer, black), 180°-360° (inner, red)
 *
 * Controls:
 * - Drag to move triangle
 * - Ctrl + drag to rotate
 * - Touch: 2 fingers to rotate
 */

class CanvasPlottingTriangle {
    /**
     * Create a plotting triangle instrument
     * @param {string} id - Unique identifier
     * @param {string} name - Display name
     * @param {number} size - Base size (hypotenuse length)
     */
    constructor(id, name = 'Triangle', size = 300) {
        this.id = id;
        this.name = name;
        this.size = size;

        // Position (reference point O = bottom vertex in canvas coordinates)
        this.x = 0;
        this.y = 0;

        // Rotation angle in degrees (0° = default orientation, clockwise positive)
        this.rotation = 0;

        // Interaction state
        this.isDragging = false;
        this.isRotating = false;
        this.dragOffset = { x: 0, y: 0 };
        this.rotationStartAngle = 0;
        this.initialRotation = 0;

        // Geometry parameters
        this.hypotenuseLength = size;
        this.height = size / 2;  // Height from hypotenuse to vertex
        this.scaleRadius = size * 0.42;  // Protractor arc radius
        this.innerScaleOffset = size * 0.05;

        // Visual properties
        this.colors = {
            stroke: '#1a1a1a',
            outerScale: '#000000',
            innerScale: '#cc0000',
            directionLine: '#333333',
            centerLine: '#000000',
            labelText: '#000000',
            innerLabelText: '#cc0000',
            compassLabel: '#666666',
            highlight: '#FF5722'
        };

        this.isHighlighted = false;
    }

    /**
     * Set position (O = bottom vertex position)
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Set rotation angle
     */
    setRotation(degrees) {
        this.rotation = degrees;
    }

    /**
     * Get normalized rotation angle (0-360)
     */
    getRotation() {
        return ((this.rotation % 360) + 360) % 360;
    }

    /**
     * Start dragging
     */
    startDrag(mouseX, mouseY) {
        this.isDragging = true;
        this.dragOffset = {
            x: mouseX - this.x,
            y: mouseY - this.y
        };
    }

    /**
     * Update drag position
     */
    updateDrag(mouseX, mouseY) {
        if (!this.isDragging) return false;
        this.x = mouseX - this.dragOffset.x;
        this.y = mouseY - this.dragOffset.y;
        return true;
    }

    /**
     * Stop dragging
     */
    stopDrag() {
        this.isDragging = false;
    }

    /**
     * Start rotation
     */
    startRotation(mouseX, mouseY) {
        this.isRotating = true;
        this.rotationStartAngle = Math.atan2(mouseY - this.y, mouseX - this.x) * 180 / Math.PI;
        this.initialRotation = this.rotation;
    }

    /**
     * Update rotation by mouse position
     */
    updateRotationByMouse(mouseX, mouseY) {
        if (!this.isRotating) return false;
        const currentAngle = Math.atan2(mouseY - this.y, mouseX - this.x) * 180 / Math.PI;
        const deltaAngle = currentAngle - this.rotationStartAngle;
        this.rotation = this.initialRotation + deltaAngle;
        return true;
    }

    /**
     * Stop rotation
     */
    stopRotation() {
        this.isRotating = false;
    }

    /**
     * Check if point is within the triangle bounds
     */
    containsPoint(px, py) {
        // Transform point to local coordinates (account for rotation)
        const dx = px - this.x;
        const dy = py - this.y;
        const angleRad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

        // Triangle vertices in local coordinates (O at origin)
        const halfHyp = this.hypotenuseLength / 2;
        const height = this.height;

        // Check if point is within triangle bounds (simple bounding box first)
        if (localX < -halfHyp - 20 || localX > halfHyp + 20) return false;
        if (localY < -height - 20 || localY > 40) return false;

        // More precise check: point-in-triangle test
        // Vertices: O(0,0), A(-halfHyp, -height), B(halfHyp, -height)
        const v0x = 0, v0y = 0;
        const v1x = -halfHyp, v1y = -height;
        const v2x = halfHyp, v2y = -height;

        // Expand triangle for easier interaction
        const expand = 25;

        // Check if within expanded bounding box
        const minX = Math.min(v0x, v1x, v2x) - expand;
        const maxX = Math.max(v0x, v1x, v2x) + expand;
        const minY = Math.min(v0y, v1y, v2y) - expand;
        const maxY = Math.max(v0y, v1y, v2y) + expand;

        return localX >= minX && localX <= maxX && localY >= minY && localY <= maxY;
    }

    /**
     * Set highlight state
     */
    setHighlight(enabled) {
        this.isHighlighted = enabled;
    }

    /**
     * Draw the triangle on canvas
     */
    draw(ctx) {
        ctx.save();

        // Move to triangle position and rotate
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);

        const halfHyp = this.hypotenuseLength / 2;
        const height = this.height;

        // Draw triangle outline
        ctx.beginPath();
        ctx.moveTo(0, 0);  // Vertex O (bottom)
        ctx.lineTo(-halfHyp, -height);  // Top-left
        ctx.lineTo(halfHyp, -height);  // Top-right
        ctx.closePath();

        ctx.strokeStyle = this.isHighlighted ? this.colors.highlight : this.colors.stroke;
        ctx.lineWidth = this.isHighlighted ? 3 : 2;
        ctx.stroke();

        // Draw protractor arcs (centered at hypotenuse, opening downward)
        const arcCenterX = 0;
        const arcCenterY = -height;
        const outerRadius = this.scaleRadius;
        const innerRadius = outerRadius - this.innerScaleOffset;

        // Outer arc (0° - 180°)
        ctx.beginPath();
        ctx.arc(arcCenterX, arcCenterY, outerRadius, 0, Math.PI);
        ctx.strokeStyle = this.colors.outerScale;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Inner arc (180° - 360°)
        ctx.beginPath();
        ctx.arc(arcCenterX, arcCenterY, innerRadius, 0, Math.PI);
        ctx.strokeStyle = this.colors.innerScale;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Draw tick marks
        this.drawTickMarks(ctx, arcCenterX, arcCenterY, outerRadius, innerRadius);

        // Draw directional lines
        this.drawDirectionalLines(ctx, halfHyp, height);

        // Draw angle labels
        this.drawLabels(ctx, arcCenterX, arcCenterY, outerRadius, innerRadius);

        // Draw center point O (rotation center)
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = this.colors.innerScale;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw triangle name and angle
        ctx.fillStyle = this.colors.labelText;
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, 0, 20);

        ctx.fillStyle = this.colors.innerScale;
        ctx.font = '9px monospace';
        const normalizedAngle = this.getRotation();
        ctx.fillText(`${Math.round(normalizedAngle)}°`, 0, 32);

        ctx.restore();
    }

    /**
     * Draw tick marks for the protractor scale
     */
    drawTickMarks(ctx, centerX, centerY, outerRadius, innerRadius) {
        // Outer scale ticks (0° - 180°)
        for (let deg = 0; deg <= 180; deg++) {
            let tickLen;
            if (deg % 10 === 0) {
                tickLen = 12;
            } else if (deg % 5 === 0) {
                tickLen = 8;
            } else {
                tickLen = 4;
            }

            // Map scale degrees to SVG angles
            // 0° scale -> 180° SVG (pointing left)
            // 180° scale -> 0° SVG (pointing right)
            const svgAngle = (180 - deg) * Math.PI / 180;

            const outerX = centerX + outerRadius * Math.cos(svgAngle);
            const outerY = centerY + outerRadius * Math.sin(svgAngle);
            const innerX = centerX + (outerRadius + tickLen) * Math.cos(svgAngle);
            const innerY = centerY + (outerRadius + tickLen) * Math.sin(svgAngle);

            ctx.beginPath();
            ctx.moveTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
            ctx.strokeStyle = this.colors.outerScale;
            ctx.lineWidth = deg % 10 === 0 ? 1.2 : 0.6;
            ctx.stroke();
        }

        // Inner scale ticks (180° - 360°)
        for (let deg = 180; deg <= 360; deg++) {
            let tickLen;
            if (deg % 10 === 0) {
                tickLen = 10;
            } else if (deg % 5 === 0) {
                tickLen = 6;
            } else {
                tickLen = 3;
            }

            const mappedDeg = deg - 180;
            const svgAngle = (180 - mappedDeg) * Math.PI / 180;

            const outerX = centerX + innerRadius * Math.cos(svgAngle);
            const outerY = centerY + innerRadius * Math.sin(svgAngle);
            const innerX = centerX + (innerRadius + tickLen) * Math.cos(svgAngle);
            const innerY = centerY + (innerRadius + tickLen) * Math.sin(svgAngle);

            ctx.beginPath();
            ctx.moveTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
            ctx.strokeStyle = this.colors.innerScale;
            ctx.lineWidth = deg % 10 === 0 ? 1 : 0.5;
            ctx.stroke();
        }
    }

    /**
     * Draw directional lines
     */
    drawDirectionalLines(ctx, halfHyp, height) {
        ctx.strokeStyle = this.colors.centerLine;
        ctx.lineWidth = 1.2;

        // Main vertical line (90° / 270°) - from vertex O to hypotenuse center
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -height + 2);
        ctx.stroke();

        // Line along left leg (0° / 360°)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-halfHyp + 3, -height + 3);
        ctx.stroke();

        // Line along right leg (180°)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(halfHyp - 3, -height + 3);
        ctx.stroke();

        // Auxiliary lines (45° and 135°) - dashed
        ctx.strokeStyle = this.colors.directionLine;
        ctx.setLineDash([4, 2]);
        ctx.lineWidth = 1;

        // 45° line from hypotenuse center to left leg
        ctx.beginPath();
        ctx.moveTo(0, -height + 2);
        ctx.lineTo(-halfHyp / 2, -halfHyp / 2);
        ctx.stroke();

        // 135° line from hypotenuse center to right leg
        ctx.beginPath();
        ctx.moveTo(0, -height + 2);
        ctx.lineTo(halfHyp / 2, -halfHyp / 2);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    /**
     * Draw angle labels
     */
    drawLabels(ctx, centerX, centerY, outerRadius, innerRadius) {
        const labelOffset = 18;
        const innerLabelOffset = 15;

        // Outer scale labels (0° - 180°) every 10°
        ctx.fillStyle = this.colors.labelText;
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let deg = 0; deg <= 180; deg += 10) {
            const svgAngle = (180 - deg) * Math.PI / 180;
            const labelRadius = outerRadius + labelOffset;
            const x = centerX + labelRadius * Math.cos(svgAngle);
            const y = centerY + labelRadius * Math.sin(svgAngle);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((90 - deg) * Math.PI / 180);
            ctx.fillText(deg.toString(), 0, 0);
            ctx.restore();
        }

        // Inner scale labels (180° - 360°) every 10°
        ctx.fillStyle = this.colors.innerLabelText;
        ctx.font = '6.5px Arial';

        for (let deg = 180; deg <= 360; deg += 10) {
            const mappedDeg = deg - 180;
            const svgAngle = (180 - mappedDeg) * Math.PI / 180;
            const labelRadius = innerRadius + innerLabelOffset;
            const x = centerX + labelRadius * Math.cos(svgAngle);
            const y = centerY + labelRadius * Math.sin(svgAngle);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((90 - mappedDeg) * Math.PI / 180);
            ctx.fillText(deg.toString(), 0, 0);
            ctx.restore();
        }
    }
}

/**
 * Manager for multiple canvas-based plotting triangles
 */
class NauticalTriangleManager {
    constructor() {
        this.triangles = new Map();
        this.activeTriangle = null;
        this.ctrlKeyPressed = false;

        // Track keyboard state
        this.setupKeyboardListeners();
    }

    /**
     * Setup keyboard listeners for Ctrl key
     */
    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                this.ctrlKeyPressed = true;
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control' || e.key === 'Meta') {
                this.ctrlKeyPressed = false;
            }
        });

        // Also handle blur to reset state
        window.addEventListener('blur', () => {
            this.ctrlKeyPressed = false;
        });
    }

    /**
     * Create a triangle
     */
    createTriangle(id, name, x, y, size = 300) {
        const triangle = new CanvasPlottingTriangle(id, name, size);
        triangle.setPosition(x, y);
        this.triangles.set(id, triangle);
        return triangle;
    }

    /**
     * Create a standard pair of triangles
     */
    createStandardPair(canvasWidth, canvasHeight, size = 300) {
        const trianglePort = this.createTriangle(
            'port',
            'Port',
            canvasWidth * 0.35,
            canvasHeight * 0.55,
            size
        );

        const triangleStarboard = this.createTriangle(
            'starboard',
            'Starboard',
            canvasWidth * 0.65,
            canvasHeight * 0.55,
            size
        );

        return { port: trianglePort, starboard: triangleStarboard };
    }

    /**
     * Handle mouse down
     */
    handleMouseDown(x, y, ctrlKey = false) {
        // Check if Ctrl is pressed (from event or tracked state)
        const isRotateMode = ctrlKey || this.ctrlKeyPressed;

        // Find which triangle was clicked
        for (const [id, triangle] of this.triangles) {
            if (triangle.containsPoint(x, y)) {
                // Clean up any previous interaction
                if (this.activeTriangle) {
                    this.activeTriangle.stopDrag();
                    this.activeTriangle.stopRotation();
                    this.activeTriangle.setHighlight(false);
                }

                // Reset flags
                triangle.isDragging = false;
                triangle.isRotating = false;

                if (isRotateMode) {
                    triangle.startRotation(x, y);
                } else {
                    triangle.startDrag(x, y);
                }

                triangle.setHighlight(true);
                this.activeTriangle = triangle;
                return true;
            }
        }

        return false;
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(x, y) {
        if (!this.activeTriangle) return false;

        if (this.activeTriangle.isRotating) {
            return this.activeTriangle.updateRotationByMouse(x, y);
        } else if (this.activeTriangle.isDragging) {
            return this.activeTriangle.updateDrag(x, y);
        }

        return false;
    }

    /**
     * Handle mouse up
     */
    handleMouseUp() {
        if (this.activeTriangle) {
            this.activeTriangle.stopDrag();
            this.activeTriangle.stopRotation();
            this.activeTriangle.setHighlight(false);
            this.activeTriangle = null;
            return true;
        }
        return false;
    }

    /**
     * Update cursor based on position
     */
    updateCursor(x, y) {
        for (const [id, triangle] of this.triangles) {
            if (triangle.containsPoint(x, y)) {
                return this.ctrlKeyPressed ? 'crosshair' : 'move';
            }
        }
        return 'default';
    }

    /**
     * Draw all triangles
     */
    drawAll(ctx) {
        for (const [id, triangle] of this.triangles) {
            triangle.draw(ctx);
        }
    }

    /**
     * Get rotation angles
     */
    getRotationAngles() {
        const angles = {};
        for (const [id, triangle] of this.triangles) {
            angles[id] = triangle.getRotation();
        }
        return angles;
    }

    /**
     * Get triangle by ID
     */
    getTriangle(id) {
        return this.triangles.get(id);
    }

    /**
     * Set triangle rotation
     */
    setTriangleRotation(id, degrees) {
        const triangle = this.triangles.get(id);
        if (triangle) {
            triangle.setRotation(degrees);
        }
    }

    /**
     * Remove all triangles
     */
    removeAll() {
        this.triangles.clear();
        this.activeTriangle = null;
    }
}

// Export globally
window.CanvasPlottingTriangle = CanvasPlottingTriangle;
window.NauticalTriangleManager = NauticalTriangleManager;
