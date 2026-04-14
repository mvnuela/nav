/**
 * Nautical Plotting Triangle Component - Canvas Version
 * Professional maritime navigation plotting triangle for course plotting
 * Matches the SVG/Leaflet version's visual style.
 *
 * Technical Specifications (based on standard nautical plotting triangle):
 * - Isosceles right triangle (45-45-90)
 * - Hypotenuse at TOP (horizontal), 90 vertex pointing DOWN
 * - Reference point O = 90 vertex (bottom point) = center of protractor scale
 * - Semicircular protractor scale centered at hypotenuse, opening downward
 * - Two concentric scales: 0-180 (outer, black), 180-360 (inner, red)
 * - Compass direction labels (N, S, E, W, etc.)
 * - Ruler scale along legs
 *
 * Controls:
 * - Drag to move triangle
 * - Z + drag to rotate
 * - Arrow keys to nudge selected triangle
 */

class CanvasPlottingTriangle {
    constructor(id, name = 'Triangle', size = 340) {
        this.id = id;
        this.name = name;
        this.size = size;

        // Position (reference point O = bottom vertex)
        this.x = 0;
        this.y = 0;

        // Rotation angle in degrees (clockwise positive)
        this.rotation = 0;

        // Interaction state
        this.isDragging = false;
        this.isRotating = false;
        this.dragOffset = { x: 0, y: 0 };
        this.rotationStartAngle = 0;

        // Geometry
        this.hypotenuseLength = size;
        this.height = size / 2;
        this.scaleRadius = size * 0.42;
        // Wider gap so inner-scale (red) labels no longer collide with the
        // outer-scale (black) tick marks
        this.innerScaleOffset = size * 0.14;

        // Tick marks, labels, and ruler grow proportionally with the triangle.
        // 340 is the baseline size; factor > 1 at larger sizes makes the scale
        // text and tick marks clearly readable on high-resolution charts.
        const factor = size / 340;
        this.sizeFactor = factor;
        this.cfg = {
            // Thin outline — intentionally kept delicate at all zoom levels
            strokeWidth: 1.5 * factor,
            // Thin tick stroke
            thinStroke: 0.9 * factor,
            // Major/medium/minor tick lengths (significantly enlarged)
            tickShort: 12 * factor,
            tickMedium: 20 * factor,
            tickLong: 30 * factor,
            // Label offsets from scale arc
            labelOffset: 30 * factor,
            innerLabelOffset: 24 * factor,
            // Ruler tick spacing along legs
            rulerSpacing: 20 * factor,
            // Font sizes — larger base so degree numbers are readable
            outerLabelFont: 16 * factor,
            innerLabelFont: 13 * factor,
            compassFont: 13 * factor,
            rulerFont: 12 * factor,
            nameFont: 14 * factor,
            angleFont: 12 * factor
        };

        // Colors matching SVG version
        this.colors = {
            stroke: '#1a1a1a',
            outerScale: '#000000',
            innerScale: '#cc0000',
            directionLine: '#333333',
            centerLine: '#000000',
            labelText: '#000000',
            innerLabelText: '#cc0000',
            compassLabel: '#666666',
            highlight: '#FF5722',
            shadow: 'rgba(0,0,0,0.18)'
        };

        this.isHighlighted = false;
    }

    setPosition(x, y) { this.x = x; this.y = y; }
    setRotation(degrees) { this.rotation = degrees; }
    getRotation() { return ((this.rotation % 360) + 360) % 360; }

    startDrag(mouseX, mouseY) {
        this.isDragging = true;
        this.dragOffset = { x: mouseX - this.x, y: mouseY - this.y };
    }

    updateDrag(mouseX, mouseY) {
        if (!this.isDragging) return false;
        this.x = mouseX - this.dragOffset.x;
        this.y = mouseY - this.dragOffset.y;
        return true;
    }

    stopDrag() { this.isDragging = false; }

    startRotation(mouseX, mouseY) {
        this.isRotating = true;
        this.rotationStartAngle = Math.atan2(mouseY - (this.y - this.height), mouseX - this.x) * 180 / Math.PI;
    }

    updateRotationByMouse(mouseX, mouseY) {
        if (!this.isRotating) return false;
        const currentAngle = Math.atan2(mouseY - (this.y - this.height), mouseX - this.x) * 180 / Math.PI;
        let delta = currentAngle - this.rotationStartAngle;
        delta = ((delta + 180) % 360 + 360) % 360 - 180;
        this.rotation += delta;
        this.rotationStartAngle = currentAngle;
        return true;
    }

    stopRotation() { this.isRotating = false; }

    containsPoint(px, py) {
        const height = this.height;
        const dx = px - this.x;
        const dy = py - (this.y - height);
        const angleRad = -this.rotation * Math.PI / 180;
        const localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad) - height;

        const halfHyp = this.hypotenuseLength / 2;
        const expand = 25;
        const minX = -halfHyp - expand;
        const maxX = halfHyp + expand;
        const minY = -height - expand;
        const maxY = 0 + expand;

        return localX >= minX && localX <= maxX && localY >= minY && localY <= maxY;
    }

    setHighlight(enabled) { this.isHighlighted = enabled; }

    // ─── Drawing ───

    draw(ctx) {
        ctx.save();

        const halfHyp = this.hypotenuseLength / 2;
        const height = this.height;

        // Pivot = hypotenuse midpoint
        ctx.translate(this.x, this.y - height);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.translate(0, height);

        // ── Drop shadow ──
        ctx.save();
        ctx.shadowColor = this.colors.shadow;
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        // Draw invisible fill just for shadow
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-halfHyp, -height);
        ctx.lineTo(halfHyp, -height);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.01)';
        ctx.fill();
        ctx.restore();

        // ── Triangle outline (transparent body, just stroke) ──
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-halfHyp, -height);
        ctx.lineTo(halfHyp, -height);
        ctx.closePath();
        ctx.strokeStyle = this.isHighlighted ? this.colors.highlight : this.colors.stroke;
        // Thin outline at all zooms; highlight slightly thicker but still light
        ctx.lineWidth = this.isHighlighted ? this.cfg.strokeWidth * 2.5 : this.cfg.strokeWidth;
        ctx.stroke();

        // Arc positioning
        const arcCX = 0;
        const arcCY = -height;
        const outerR = this.scaleRadius;
        const innerR = outerR - this.innerScaleOffset;

        // ── Tick marks ──
        this.drawTickMarks(ctx, arcCX, arcCY, outerR, innerR);

        // ── Directional lines ──
        this.drawDirectionalLines(ctx, halfHyp, height);

        // ── Angle labels ──
        this.drawLabels(ctx, arcCX, arcCY, outerR, innerR);

        // ── Compass direction labels ──
        this.drawCompassLabels(ctx, arcCX, arcCY, outerR, innerR);

        // ── Ruler scale along legs ──
        this.drawRulerScale(ctx, halfHyp, height);

        // ── Name and angle readout ──
        const normalizedAngle = this.getRotation();
        // Name
        ctx.fillStyle = this.colors.labelText;
        ctx.font = `bold ${this.cfg.nameFont}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(this.name, 0, this.cfg.nameFont * 2.2);
        // Angle
        ctx.fillStyle = this.colors.innerScale;
        ctx.font = `${this.cfg.angleFont}px monospace`;
        ctx.fillText(Math.round(normalizedAngle) + '\u00B0', 0, this.cfg.nameFont * 2.2 + this.cfg.angleFont * 1.4);

        ctx.restore();
    }

    drawTickMarks(ctx, cx, cy, outerR, innerR) {
        const cfg = this.cfg;

        // Outer scale (0-180, black)
        for (let deg = 0; deg <= 180; deg++) {
            let tickLen, lw;
            if (deg % 10 === 0) { tickLen = cfg.tickLong; lw = cfg.strokeWidth; }
            else if (deg % 5 === 0) { tickLen = cfg.tickMedium; lw = cfg.thinStroke; }
            else { tickLen = cfg.tickShort; lw = cfg.thinStroke; }

            const a = (180 - deg) * Math.PI / 180;
            const x1 = cx + outerR * Math.cos(a);
            const y1 = cy + outerR * Math.sin(a);
            const x2 = cx + (outerR + tickLen) * Math.cos(a);
            const y2 = cy + (outerR + tickLen) * Math.sin(a);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = this.colors.outerScale;
            ctx.lineWidth = lw;
            ctx.stroke();
        }

        // Inner scale (180-360, red)
        for (let deg = 180; deg <= 360; deg++) {
            let tickLen, lw;
            if (deg % 10 === 0) { tickLen = cfg.tickLong * 0.85; lw = cfg.strokeWidth; }
            else if (deg % 5 === 0) { tickLen = cfg.tickMedium * 0.85; lw = cfg.thinStroke; }
            else { tickLen = cfg.tickShort * 0.85; lw = cfg.thinStroke; }

            const mapped = deg - 180;
            const a = (180 - mapped) * Math.PI / 180;
            const x1 = cx + innerR * Math.cos(a);
            const y1 = cy + innerR * Math.sin(a);
            const x2 = cx + (innerR + tickLen) * Math.cos(a);
            const y2 = cy + (innerR + tickLen) * Math.sin(a);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = this.colors.innerScale;
            ctx.lineWidth = lw;
            ctx.stroke();
        }
    }

    drawDirectionalLines(ctx, halfHyp, height) {
        // Main solid lines
        ctx.strokeStyle = this.colors.centerLine;
        ctx.lineWidth = this.cfg.strokeWidth;
        ctx.setLineDash([]);

        // Vertical (90/270)
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -height + 2); ctx.stroke();
        // Left leg (0/360)
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-halfHyp + 3, -height + 3); ctx.stroke();
        // Right leg (180)
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(halfHyp - 3, -height + 3); ctx.stroke();

        // Auxiliary dashed lines (45 and 135)
        ctx.strokeStyle = this.colors.directionLine;
        ctx.lineWidth = this.cfg.strokeWidth * 0.9;
        ctx.setLineDash([4, 2]);

        ctx.beginPath(); ctx.moveTo(0, -height + 2); ctx.lineTo(-halfHyp / 2, -halfHyp / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -height + 2); ctx.lineTo(halfHyp / 2, -halfHyp / 2); ctx.stroke();

        ctx.setLineDash([]);
    }

    drawLabels(ctx, cx, cy, outerR, innerR) {
        const cfg = this.cfg;

        // Outer labels (0-180) every 10 degrees
        ctx.fillStyle = this.colors.labelText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let deg = 0; deg <= 180; deg += 10) {
            const a = (180 - deg) * Math.PI / 180;
            const r = outerR + cfg.labelOffset;
            const x = cx + r * Math.cos(a);
            const y = cy + r * Math.sin(a);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((90 - deg) * Math.PI / 180);
            ctx.font = `bold ${cfg.outerLabelFont}px Arial`;
            ctx.fillStyle = this.colors.labelText;
            ctx.fillText(deg.toString(), 0, 0);
            ctx.restore();
        }

        // Inner labels (180-360) every 10 degrees
        for (let deg = 180; deg <= 360; deg += 10) {
            const mapped = deg - 180;
            const a = (180 - mapped) * Math.PI / 180;
            const r = innerR + cfg.innerLabelOffset;
            const x = cx + r * Math.cos(a);
            const y = cy + r * Math.sin(a);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((90 - mapped) * Math.PI / 180);
            ctx.font = `bold ${cfg.innerLabelFont}px Arial`;
            ctx.fillStyle = this.colors.innerLabelText;
            ctx.fillText(deg.toString(), 0, 0);
            ctx.restore();
        }
    }

    drawCompassLabels(ctx, cx, cy, outerR, innerR) {
        const cfg = this.cfg;
        const outerLabelR = outerR + cfg.labelOffset + 20 * this.sizeFactor;
        const innerLabelR = innerR + cfg.innerLabelOffset + 15 * this.sizeFactor;

        // Outer compass points (0-180)
        const outerPoints = [
            [0, 'N'], [22.5, 'NNO'], [45, 'NO'], [67.5, 'ONO'],
            [90, 'O'], [112.5, 'OSO'], [135, 'SO'], [157.5, 'SSO'], [180, 'S']
        ];

        ctx.font = `bold ${cfg.compassFont}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const [deg, label] of outerPoints) {
            const a = (180 - deg) * Math.PI / 180;
            const x = cx + outerLabelR * Math.cos(a);
            const y = cy + outerLabelR * Math.sin(a);
            ctx.fillStyle = this.colors.compassLabel;
            ctx.fillText(label, x, y);
        }

        // Inner compass points (180-360)
        const innerPoints = [
            [202.5, 'SSW'], [225, 'SW'], [247.5, 'WSW'],
            [270, 'W'], [292.5, 'WNW'], [315, 'NW'], [337.5, 'NNW']
        ];

        for (const [deg, label] of innerPoints) {
            const mapped = deg - 180;
            const a = (180 - mapped) * Math.PI / 180;
            const x = cx + innerLabelR * Math.cos(a);
            const y = cy + innerLabelR * Math.sin(a);
            ctx.fillStyle = this.colors.innerLabelText;
            ctx.fillText(label, x, y);
        }
    }

    drawRulerScale(ctx, halfHyp, height) {
        const spacing = this.cfg.rulerSpacing;
        const legLen = Math.sqrt(halfHyp * halfHyp + height * height);
        const tickCount = Math.floor(legLen / spacing);

        // Directions along each leg (normalised)
        const leftDx = -halfHyp / legLen;
        const leftDy = -height / legLen;
        const rightDx = halfHyp / legLen;
        const rightDy = -height / legLen;

        // Perpendicular (inward) for tick direction
        const leftPerpX = -leftDy;
        const leftPerpY = leftDx;
        const rightPerpX = rightDy;
        const rightPerpY = -rightDx;

        ctx.strokeStyle = this.colors.stroke;
        ctx.fillStyle = this.colors.labelText;
        ctx.font = `${this.cfg.rulerFont}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= tickCount; i++) {
            const t = i * spacing;
            const isMajor = i % 5 === 0;
            const tickLen = (isMajor ? 12 : 6) * this.sizeFactor;
            const lw = isMajor ? this.cfg.strokeWidth : this.cfg.thinStroke;

            // Left leg
            const lx = leftDx * t;
            const ly = leftDy * t;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + leftPerpX * tickLen, ly + leftPerpY * tickLen);
            ctx.lineWidth = lw;
            ctx.stroke();

            // Right leg
            const rx = rightDx * t;
            const ry = rightDy * t;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + rightPerpX * tickLen, ry + rightPerpY * tickLen);
            ctx.lineWidth = lw;
            ctx.stroke();

            // Labels on major ticks
            if (isMajor && i > 0) {
                const labelDist = tickLen + 6 * this.sizeFactor;
                ctx.fillText(i.toString(),
                    lx + leftPerpX * labelDist,
                    ly + leftPerpY * labelDist);
                ctx.fillText(i.toString(),
                    rx + rightPerpX * labelDist,
                    ry + rightPerpY * labelDist);
            }
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
        this.selectedTriangle = null;
        this.zKeyPressed = false;
        this.onPositionChange = null;

        this.setupKeyboardListeners();
    }

    setupKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'z' || e.key === 'Z') {
                this.zKeyPressed = true;
                return;
            }
            if (!this.selectedTriangle) return;
            const step = e.shiftKey ? 20 : 5;
            switch (e.key) {
                case 'ArrowUp':    this.selectedTriangle.y -= step; break;
                case 'ArrowDown':  this.selectedTriangle.y += step; break;
                case 'ArrowLeft':  this.selectedTriangle.x -= step; break;
                case 'ArrowRight': this.selectedTriangle.x += step; break;
                default: return;
            }
            e.preventDefault();
            this.onPositionChange?.();
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === 'z' || e.key === 'Z') {
                this.zKeyPressed = false;
            }
        });

        window.addEventListener('blur', () => {
            this.zKeyPressed = false;
        });
    }

    createTriangle(id, name, x, y, size = 340) {
        const triangle = new CanvasPlottingTriangle(id, name, size);
        triangle.setPosition(x, y);
        this.triangles.set(id, triangle);
        return triangle;
    }

    createStandardPair(canvasWidth, canvasHeight, size = 340) {
        const port = this.createTriangle('port', 'Port', canvasWidth * 0.35, canvasHeight * 0.55, size);
        const starboard = this.createTriangle('starboard', 'Starboard', canvasWidth * 0.65, canvasHeight * 0.55, size);
        return { port, starboard };
    }

    handleMouseDown(x, y) {
        const isRotateMode = this.zKeyPressed;

        for (const [id, triangle] of this.triangles) {
            if (triangle.containsPoint(x, y)) {
                if (this.activeTriangle) {
                    this.activeTriangle.stopDrag();
                    this.activeTriangle.stopRotation();
                    this.activeTriangle.setHighlight(false);
                }

                triangle.isDragging = false;
                triangle.isRotating = false;

                if (isRotateMode) {
                    triangle.startRotation(x, y);
                } else {
                    triangle.startDrag(x, y);
                }

                triangle.setHighlight(true);
                this.activeTriangle = triangle;
                this.selectedTriangle = triangle;
                return true;
            }
        }
        return false;
    }

    handleMouseMove(x, y) {
        if (!this.activeTriangle) return false;
        if (this.activeTriangle.isRotating) {
            return this.activeTriangle.updateRotationByMouse(x, y);
        } else if (this.activeTriangle.isDragging) {
            return this.activeTriangle.updateDrag(x, y);
        }
        return false;
    }

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

    updateCursor(x, y) {
        for (const [id, triangle] of this.triangles) {
            if (triangle.containsPoint(x, y)) {
                return this.zKeyPressed ? 'crosshair' : 'move';
            }
        }
        return 'default';
    }

    drawAll(ctx) {
        for (const [id, triangle] of this.triangles) {
            triangle.draw(ctx);
        }
    }

    getRotationAngles() {
        const angles = {};
        for (const [id, triangle] of this.triangles) {
            angles[id] = triangle.getRotation();
        }
        return angles;
    }

    getTriangle(id) { return this.triangles.get(id); }

    setTriangleRotation(id, degrees) {
        const triangle = this.triangles.get(id);
        if (triangle) triangle.setRotation(degrees);
    }

    removeAll() {
        this.triangles.clear();
        this.activeTriangle = null;
    }
}

window.CanvasPlottingTriangle = CanvasPlottingTriangle;
window.NauticalTriangleManager = NauticalTriangleManager;
