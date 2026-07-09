/**
 * Nautical Plotting Triangle Component
 * Professional maritime navigation plotting triangle for course plotting
 *
 * Technical Specifications (based on standard nautical plotting triangle):
 * - Isosceles right triangle (45°-45°-90°)
 * - Hypotenuse at TOP (horizontal), 90° vertex pointing DOWN
 * - Reference point O = 90° vertex (bottom point) = center of protractor scale
 * - Semicircular protractor scale centered at O
 * - Two concentric scales: 0°-180° (outer, black), 180°-360° (inner, red)
 * - Linear ruler scale along hypotenuse (top edge)
 * - Compass rose direction labels (N, S, E, W, NE, NW, etc.)
 * - Directional lines radiating from O to triangle edges
 */

class PlottingTriangle {
    /**
     * Create a plotting triangle instrument
     * @param {string} id - Unique identifier
     * @param {string} name - Display name
     * @param {number} scale - Scale factor (default 1.0)
     */
    constructor(id, name = 'Triangle', scale = 1.0) {
        this.id = id;
        this.name = name;
        this.scale = scale;

        // Position (reference point O = bottom vertex in screen coordinates)
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

        // Geometry parameters (base units, scaled by this.scale)
        this.config = {
            // Hypotenuse length (top edge)
            hypotenuseLength: 340,
            // Leg length (calculated: hypotenuse / sqrt(2))
            get legLength() { return this.hypotenuseLength / Math.SQRT2; },
            // Triangle height (from hypotenuse to vertex)
            get height() { return this.hypotenuseLength / 2; },
            // Protractor scale radius - arc starts at hypotenuse, curves down toward vertex
            // Radius should be close to half the hypotenuse so 0° and 180° are near the corners
            get scaleRadius() { return this.hypotenuseLength * 0.42; },
            // Inner scale radius offset
            innerScaleOffset: 18,
            // Tick mark lengths (pointing inward toward vertex)
            tickShort: 6,      // 1° intervals
            tickMedium: 10,    // 5° intervals
            tickLong: 15,      // 10° intervals
            // Label offset from scale arc (toward vertex)
            labelOffset: 18,
            // Inner label offset
            innerLabelOffset: 15,
            // Line widths
            strokeWidth: 1.2,
            thinStroke: 0.8,
            // Ruler tick spacing (in units, e.g., cm)
            rulerSpacing: 20,
            // Directional line extension
            lineExtension: 15
        };

        // Visual properties
        this.colors = {
            fill: 'none',  // Fully transparent interior
            stroke: '#1a1a1a',
            scale: '#000000',
            innerScale: '#cc0000',  // Red for inner scale (180°-360°)
            outerScale: '#000000',  // Black for outer scale (0°-180°)
            directionLine: '#333333',
            centerLine: '#000000',
            rulerLine: '#000000',
            labelText: '#000000',
            innerLabelText: '#cc0000',
            compassLabel: '#666666'
        };

        // SVG element reference
        this.svgElement = null;
        this.groupElement = null;
    }

    /**
     * Get scaled value
     */
    s(value) {
        return value * this.scale;
    }

    /**
     * Calculate point position on arc for given angle
     * Angle measured from bottom (0°) clockwise
     * At 0°: point is directly below O (south)
     * At 90°: point is to the left of O (east in nautical terms when looking at chart)
     * At 180°: point is above O (but still below hypotenuse)
     *
     * For SVG coordinates (y increases downward):
     * x = R · sin(θ)
     * y = R · cos(θ)  (positive = down from O)
     */
    arcPoint(radius, angleDeg) {
        const angleRad = (angleDeg * Math.PI) / 180;
        return {
            x: radius * Math.sin(angleRad),
            y: radius * Math.cos(angleRad)
        };
    }

    /**
     * Generate SVG path for the triangle outline
     * Hypotenuse at top, 90° vertex at bottom
     */
    generateTrianglePath() {
        const hypLen = this.s(this.config.hypotenuseLength);
        const halfHyp = hypLen / 2;

        // Height from hypotenuse to vertex = leg * cos(45°) = leg / sqrt(2) = hypotenuse / 2
        const height = halfHyp;

        // Vertices (O at origin, which is the bottom vertex)
        const vertex = { x: 0, y: 0 };  // Bottom vertex (90° angle) - reference point O
        const leftCorner = { x: -halfHyp, y: -height };   // Top-left (45° angle)
        const rightCorner = { x: halfHyp, y: -height };   // Top-right (45° angle)

        return `M ${vertex.x} ${vertex.y} L ${leftCorner.x} ${leftCorner.y} L ${rightCorner.x} ${rightCorner.y} Z`;
    }

    /**
     * Generate tick marks for the protractor scale
     * Arc is positioned AT the hypotenuse, opening DOWNWARD toward vertex O
     * Arc center is at the CENTER of the hypotenuse
     * 0° at left corner, 90° at bottom of arc, 180° at right corner
     * Outer scale: 0° - 180° (black)
     * Inner scale: 180° - 360° (red)
     */
    generateTickMarks() {
        const cfg = this.config;
        const outerRadius = this.s(cfg.scaleRadius);
        const innerRadius = outerRadius - this.s(cfg.innerScaleOffset);
        const halfHyp = this.s(cfg.hypotenuseLength) / 2;
        const height = halfHyp;

        // Arc center is AT the hypotenuse center
        const arcCenterX = 0;
        const arcCenterY = -height;

        const ticks = [];

        // The semicircle opens DOWNWARD from the hypotenuse
        // 0° is at the LEFT end of hypotenuse
        // 90° is at the BOTTOM of the arc (pointing toward vertex)
        // 180° is at the RIGHT end of hypotenuse

        // Generate outer scale ticks (0° - 180°)
        for (let deg = 0; deg <= 180; deg++) {
            let tickLen;
            if (deg % 10 === 0) {
                tickLen = this.s(cfg.tickLong);
            } else if (deg % 5 === 0) {
                tickLen = this.s(cfg.tickMedium);
            } else {
                tickLen = this.s(cfg.tickShort);
            }

            // Map scale degrees to SVG angles
            // 0° scale -> 180° SVG (pointing left along hypotenuse)
            // 90° scale -> 270° SVG (pointing down toward vertex)
            // 180° scale -> 360°/0° SVG (pointing right along hypotenuse)
            const svgAngle = 180 - deg;

            // Outer point is on the arc (AT the hypotenuse level for 0° and 180°)
            const outerPoint = this.arcPointAtHypotenuse(outerRadius, svgAngle, arcCenterX, arcCenterY);
            // Inner point is further toward vertex (tick points inward/downward)
            const innerPoint = this.arcPointAtHypotenuse(outerRadius + tickLen, svgAngle, arcCenterX, arcCenterY);

            ticks.push({
                x1: outerPoint.x,
                y1: outerPoint.y,
                x2: innerPoint.x,
                y2: innerPoint.y,
                isMajor: deg % 10 === 0,
                isOuter: true,
                angle: deg
            });
        }

        // Generate inner scale ticks (180° - 360°)
        for (let deg = 180; deg <= 360; deg++) {
            let tickLen;
            if (deg % 10 === 0) {
                tickLen = this.s(cfg.tickLong) * 0.85;
            } else if (deg % 5 === 0) {
                tickLen = this.s(cfg.tickMedium) * 0.85;
            } else {
                tickLen = this.s(cfg.tickShort) * 0.85;
            }

            const mappedDeg = deg - 180;
            const svgAngle = 180 - mappedDeg;

            const outerPoint = this.arcPointAtHypotenuse(innerRadius, svgAngle, arcCenterX, arcCenterY);
            const innerPoint = this.arcPointAtHypotenuse(innerRadius + tickLen, svgAngle, arcCenterX, arcCenterY);

            ticks.push({
                x1: outerPoint.x,
                y1: outerPoint.y,
                x2: innerPoint.x,
                y2: innerPoint.y,
                isMajor: deg % 10 === 0,
                isOuter: false,
                angle: deg
            });
        }

        return ticks;
    }

    /**
     * Calculate point on arc centered at hypotenuse
     * Arc center is at (centerX, centerY) which is on the hypotenuse
     * Arc opens downward (positive Y direction in our coord system)
     */
    arcPointAtHypotenuse(radius, svgAngleDeg, centerX, centerY) {
        const angleRad = (svgAngleDeg * Math.PI) / 180;
        return {
            x: centerX + radius * Math.cos(angleRad),
            y: centerY + radius * Math.sin(angleRad)
        };
    }

    /**
     * Calculate point on arc using SVG angle convention
     * 0° = right (positive x), 90° = down (positive y)
     */
    arcPointFromSvgAngle(radius, angleDeg) {
        const angleRad = (angleDeg * Math.PI) / 180;
        return {
            x: radius * Math.cos(angleRad),
            y: -radius * Math.sin(angleRad)  // Negative because we want up to be negative y
        };
    }

    /**
     * Generate angle labels for the scales
     * Labels are positioned along the arc, inside the arc (toward vertex)
     */
    generateLabels() {
        const cfg = this.config;
        const outerRadius = this.s(cfg.scaleRadius);
        const innerRadius = outerRadius - this.s(cfg.innerScaleOffset);
        const halfHyp = this.s(cfg.hypotenuseLength) / 2;
        const height = halfHyp;

        // Arc center at hypotenuse
        const arcCenterX = 0;
        const arcCenterY = -height;

        // Labels are positioned inside the arc (toward vertex), so add to radius
        const outerLabelRadius = outerRadius + this.s(cfg.labelOffset);
        const innerLabelRadius = innerRadius + this.s(cfg.innerLabelOffset);

        const labels = [];

        // Outer scale labels (0° - 180°) every 10°
        for (let deg = 0; deg <= 180; deg += 10) {
            const svgAngle = 180 - deg;
            const pos = this.arcPointAtHypotenuse(outerLabelRadius, svgAngle, arcCenterX, arcCenterY);

            // Rotate text to be readable
            // Text should be perpendicular to the radius, readable from inside
            let textRotation = 90 - deg;

            labels.push({
                x: pos.x,
                y: pos.y,
                text: deg.toString(),
                rotation: textRotation,
                isOuter: true
            });
        }

        // Inner scale labels (180° - 360°) every 10°
        for (let deg = 180; deg <= 360; deg += 10) {
            const mappedDeg = deg - 180;
            const svgAngle = 180 - mappedDeg;
            const pos = this.arcPointAtHypotenuse(innerLabelRadius, svgAngle, arcCenterX, arcCenterY);

            let textRotation = 90 - mappedDeg;

            labels.push({
                x: pos.x,
                y: pos.y,
                text: deg.toString(),
                rotation: textRotation,
                isOuter: false
            });
        }

        return labels;
    }

    /**
     * Generate compass direction labels
     * Positioned inside the protractor arc (between arc and vertex)
     */
    generateCompassLabels() {
        const cfg = this.config;
        const outerRadius = this.s(cfg.scaleRadius);
        const innerRadius = outerRadius - this.s(cfg.innerScaleOffset);
        const halfHyp = this.s(cfg.hypotenuseLength) / 2;
        const height = halfHyp;

        // Arc center at hypotenuse
        const arcCenterX = 0;
        const arcCenterY = -height;

        // Compass labels positioned inside the scale (further from hypotenuse)
        const labelRadius = outerRadius + this.s(cfg.labelOffset) + this.s(20);
        const innerLabelRadius = innerRadius + this.s(cfg.innerLabelOffset) + this.s(15);

        // Compass points for outer scale (0° - 180°)
        const compassPoints = [
            { angle: 0, label: 'N' },
            { angle: 22.5, label: 'NNO' },
            { angle: 45, label: 'NO' },
            { angle: 67.5, label: 'ONO' },
            { angle: 90, label: 'O' },
            { angle: 112.5, label: 'OSO' },
            { angle: 135, label: 'SO' },
            { angle: 157.5, label: 'SSO' },
            { angle: 180, label: 'S' },
        ];

        const labels = [];
        for (const cp of compassPoints) {
            const svgAngle = 180 - cp.angle;
            const pos = this.arcPointAtHypotenuse(labelRadius, svgAngle, arcCenterX, arcCenterY);
            labels.push({
                x: pos.x,
                y: pos.y,
                text: cp.label,
                rotation: 0,
                isInner: false
            });
        }

        // Inner compass labels (180° - 360° range)
        const innerCompassPoints = [
            { angle: 202.5, label: 'SSW' },
            { angle: 225, label: 'SW' },
            { angle: 247.5, label: 'WSW' },
            { angle: 270, label: 'W' },
            { angle: 292.5, label: 'WNW' },
            { angle: 315, label: 'NW' },
            { angle: 337.5, label: 'NNW' },
        ];

        for (const cp of innerCompassPoints) {
            const mappedDeg = cp.angle - 180;
            const svgAngle = 180 - mappedDeg;
            const pos = this.arcPointAtHypotenuse(innerLabelRadius, svgAngle, arcCenterX, arcCenterY);
            labels.push({
                x: pos.x,
                y: pos.y,
                text: cp.label,
                rotation: 0,
                isInner: true
            });
        }

        return labels;
    }

    /**
     * Generate directional lines from vertex O through the protractor
     * Main lines: 0° (along left leg), 90° (vertical), 180° (along right leg)
     * Auxiliary lines: 45°, 135° extending to triangle edges
     */
    generateDirectionalLines() {
        const cfg = this.config;
        const halfHyp = this.s(cfg.hypotenuseLength) / 2;
        const height = halfHyp;

        const lines = [];

        // Main vertical line (90° compass direction / E-W)
        // From vertex O up to hypotenuse center
        lines.push({
            x1: 0,
            y1: 0,
            x2: 0,
            y2: -height + 2,
            isMain: true,
            label: '90°/270°'
        });

        // Line along left leg (0° / N direction on scale)
        // Goes from O to top-left corner
        lines.push({
            x1: 0,
            y1: 0,
            x2: -halfHyp + 3,
            y2: -height + 3,
            isMain: true,
            label: '0°/360°'
        });

        // Line along right leg (180° / S direction on scale)
        // Goes from O to top-right corner
        lines.push({
            x1: 0,
            y1: 0,
            x2: halfHyp - 3,
            y2: -height + 3,
            isMain: true,
            label: '180°'
        });

        // Auxiliary line at 45°
        // Starts from hypotenuse CENTER, extends to LEFT LEG at 45° angle
        // The line goes from (0, -height) toward the left leg
        {
            // Start point: center of hypotenuse
            const startX = 0;
            const startY = -height + 2;

            // End point: intersection with left leg
            // Left leg goes from (0, 0) to (-halfHyp, -height)
            // Left leg equation: y = x (since slope = -height / -halfHyp = 1)
            // 45° line from center going down-left at 45° from horizontal
            // Direction: (-1, 1) - going left and down
            // Line: y = -height + (x - 0) * 1 = -height + x
            // Intersect with left leg (y = x): x = -height + x → only works if we parameterize

            // Left leg: parametric from (0,0) to (-halfHyp, -height): P = t*(-halfHyp, -height)
            // 45° line from (0, -height): going at 45° down-left means slope = 1 (going toward positive y as x decreases)
            // y = -height + (-1)*(x - 0) → y = -height - x (line going down-left)
            // Wait, we want to go toward the left leg which is below and to the left

            // Actually, from the hypotenuse center at (0, -height), going toward the left leg
            // at a 45° angle means going in direction that makes 45° with horizontal
            // The left leg is at angle 45° below horizontal (going from top-left corner to vertex)
            // So a 45° auxiliary line from center should be parallel to the RIGHT leg
            // Right leg: from (0,0) to (halfHyp, -height), slope = -height/halfHyp = -1

            // Line parallel to right leg, starting from (0, -height):
            // y - (-height) = -1 * (x - 0) → y = -height - x
            // Intersects left leg (y = x) when: x = -height - x → 2x = -height → x = -height/2 = -halfHyp/2
            // y = -halfHyp/2

            const endX45 = -halfHyp / 2;
            const endY45 = -halfHyp / 2;  // Since y = x on left leg, and x = -halfHyp/2

            lines.push({
                x1: startX,
                y1: startY,
                x2: endX45,
                y2: endY45,
                isMain: false,
                isAuxiliary: true,
                label: '45°'
            });
        }

        // Auxiliary line at 135°
        // Starts from hypotenuse CENTER, extends to RIGHT LEG at 135° angle
        // Symmetric to the 45° line
        {
            const startX = 0;
            const startY = -height + 2;

            // End point: intersection with right leg
            // Right leg goes from (0, 0) to (halfHyp, -height)
            // Right leg equation: y = -x (slope = -1)
            // 135° line is parallel to left leg (slope = 1)
            // y = -height + x
            // Intersects right leg (y = -x) when: -x = -height + x → -2x = -height → x = height/2 = halfHyp/2
            // y = -halfHyp/2

            const endX135 = halfHyp / 2;
            const endY135 = -halfHyp / 2;

            lines.push({
                x1: startX,
                y1: startY,
                x2: endX135,
                y2: endY135,
                isMain: false,
                isAuxiliary: true,
                label: '135°'
            });
        }

        return lines;
    }

    /**
     * Generate the ruler scale along the triangle legs
     * Since the arc is at the hypotenuse, ruler goes on the legs
     */
    generateRulerScale() {
        const cfg = this.config;
        const halfHyp = this.s(cfg.hypotenuseLength) / 2;
        const height = halfHyp;
        const spacing = this.s(cfg.rulerSpacing);

        const ticks = [];
        const labels = [];

        // Ruler along the LEFT leg (from vertex O to top-left corner)
        // Left leg goes from (0, 0) to (-halfHyp, -height)
        const legLength = Math.sqrt(halfHyp * halfHyp + height * height);
        const numUnits = Math.floor(legLength / spacing);

        // Direction vector for left leg (normalized)
        const dirX = -halfHyp / legLength;
        const dirY = -height / legLength;

        // Perpendicular for tick direction (pointing outward from triangle)
        const perpX = -dirY;  // Points outward (to the left of the leg direction)
        const perpY = dirX;

        for (let i = 0; i <= numUnits; i++) {
            const dist = i * spacing;
            const x = dist * dirX;
            const y = dist * dirY;

            const tickLen = (i % 5 === 0) ? this.s(8) : this.s(4);

            ticks.push({
                x1: x,
                y1: y,
                x2: x + perpX * tickLen,
                y2: y + perpY * tickLen,
                isMajor: i % 5 === 0
            });

            // Add label every 5 units
            if (i % 5 === 0 && i > 0) {
                labels.push({
                    x: x + perpX * this.s(14),
                    y: y + perpY * this.s(14),
                    text: i.toString()
                });
            }
        }

        // Ruler along the RIGHT leg (from vertex O to top-right corner)
        const dirXR = halfHyp / legLength;
        const dirYR = -height / legLength;
        const perpXR = dirYR;  // Points outward (to the right of the leg direction)
        const perpYR = -dirXR;

        for (let i = 0; i <= numUnits; i++) {
            const dist = i * spacing;
            const x = dist * dirXR;
            const y = dist * dirYR;

            const tickLen = (i % 5 === 0) ? this.s(8) : this.s(4);

            ticks.push({
                x1: x,
                y1: y,
                x2: x + perpXR * tickLen,
                y2: y + perpYR * tickLen,
                isMajor: i % 5 === 0
            });

            // Add label every 5 units
            if (i % 5 === 0 && i > 0) {
                labels.push({
                    x: x + perpXR * this.s(14),
                    y: y + perpYR * this.s(14),
                    text: i.toString()
                });
            }
        }

        return { ticks, labels };
    }

    /**
     * Generate the semicircular arc paths
     * Arc starts AT the hypotenuse, opens DOWNWARD toward vertex O
     * Arc center is at the CENTER of the hypotenuse
     */
    generateArcPaths() {
        const cfg = this.config;
        const outerRadius = this.s(cfg.scaleRadius);
        const innerRadius = outerRadius - this.s(cfg.innerScaleOffset);
        const halfHyp = this.s(cfg.hypotenuseLength) / 2;
        const height = halfHyp;

        // Arc center at hypotenuse center
        const arcCenterX = 0;
        const arcCenterY = -height;

        // Outer arc - semicircle starting at hypotenuse, opening downward
        // Start at left (180° SVG = 0° scale), end at right (0° SVG = 180° scale)
        const outerStart = this.arcPointAtHypotenuse(outerRadius, 180, arcCenterX, arcCenterY);
        const outerEnd = this.arcPointAtHypotenuse(outerRadius, 0, arcCenterX, arcCenterY);
        // sweep-flag = 1 for clockwise (left -> bottom -> right)
        const outerArc = `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x} ${outerEnd.y}`;

        // Inner arc
        const innerStart = this.arcPointAtHypotenuse(innerRadius, 180, arcCenterX, arcCenterY);
        const innerEnd = this.arcPointAtHypotenuse(innerRadius, 0, arcCenterX, arcCenterY);
        const innerArc = `M ${innerStart.x} ${innerStart.y} A ${innerRadius} ${innerRadius} 0 0 1 ${innerEnd.x} ${innerEnd.y}`;

        return { outerArc, innerArc, arcCenterX, arcCenterY };
    }

    /**
     * Create the complete SVG element for this triangle
     */
    createSVG() {
        const ns = 'http://www.w3.org/2000/svg';
        const cfg = this.config;

        // Calculate dimensions
        const halfHyp = this.s(cfg.hypotenuseLength) / 2;
        const height = halfHyp;
        const padding = 40;

        const svgWidth = halfHyp * 2 + padding * 2;
        // Extend height upward by `height` so the SVG covers the full rotation arc
        // around the hypotenuse midpoint (pivot can swing up to `height` above the midpoint)
        const svgHeight = height * 2 + padding * 2;

        // Create SVG container
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'plotting-triangle');
        svg.setAttribute('data-triangle-id', this.id);
        svg.setAttribute('width', svgWidth);
        svg.setAttribute('height', svgHeight);
        // ViewBox: O (bottom vertex) at center; extended upward to capture rotated triangle
        svg.setAttribute('viewBox', `${-halfHyp - padding} ${-height * 2 - padding} ${svgWidth} ${svgHeight}`);
        svg.style.position = 'absolute';
        svg.style.overflow = 'visible';
        svg.style.userSelect = 'none';
        // Allow pointer events to pass through transparent areas
        svg.style.pointerEvents = 'none';

        // Create main group for transformations
        const mainGroup = document.createElementNS(ns, 'g');
        mainGroup.setAttribute('class', 'triangle-main-group');

        // Create defs for filters
        const defs = document.createElementNS(ns, 'defs');

        // Drop shadow filter
        const filter = document.createElementNS(ns, 'filter');
        filter.setAttribute('id', `shadow-${this.id}`);
        filter.setAttribute('x', '-10%');
        filter.setAttribute('y', '-10%');
        filter.setAttribute('width', '120%');
        filter.setAttribute('height', '120%');

        const feDropShadow = document.createElementNS(ns, 'feDropShadow');
        feDropShadow.setAttribute('dx', '2');
        feDropShadow.setAttribute('dy', '2');
        feDropShadow.setAttribute('stdDeviation', '2');
        feDropShadow.setAttribute('flood-opacity', '0.25');
        filter.appendChild(feDropShadow);
        defs.appendChild(filter);
        svg.appendChild(defs);

        // Triangle outline (transparent interior)
        const trianglePath = document.createElementNS(ns, 'path');
        trianglePath.setAttribute('d', this.generateTrianglePath());
        trianglePath.setAttribute('fill', this.colors.fill);
        trianglePath.setAttribute('stroke', this.colors.stroke);
        trianglePath.setAttribute('stroke-width', this.s(cfg.strokeWidth * 2));
        // Enable pointer events on the stroke for dragging
        trianglePath.style.pointerEvents = 'stroke';
        trianglePath.style.cursor = 'move';
        trianglePath.setAttribute('class', 'triangle-outline');
        mainGroup.appendChild(trianglePath);


        // Tick marks - enable pointer events for dragging
        const ticks = this.generateTickMarks();
        const tickGroup = document.createElementNS(ns, 'g');
        tickGroup.setAttribute('class', 'tick-marks');
        tickGroup.style.pointerEvents = 'stroke';
        tickGroup.style.cursor = 'move';

        for (const tick of ticks) {
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', tick.x1);
            line.setAttribute('y1', tick.y1);
            line.setAttribute('x2', tick.x2);
            line.setAttribute('y2', tick.y2);
            line.setAttribute('stroke', tick.isOuter ? this.colors.outerScale : this.colors.innerScale);
            line.setAttribute('stroke-width', tick.isMajor ? this.s(cfg.strokeWidth) : this.s(cfg.thinStroke));
            tickGroup.appendChild(line);
        }
        mainGroup.appendChild(tickGroup);

        // Directional lines - enable pointer events for dragging
        const dirLines = this.generateDirectionalLines();
        const lineGroup = document.createElementNS(ns, 'g');
        lineGroup.setAttribute('class', 'directional-lines');
        lineGroup.style.pointerEvents = 'stroke';
        lineGroup.style.cursor = 'move';

        for (const dl of dirLines) {
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', dl.x1);
            line.setAttribute('y1', dl.y1);
            line.setAttribute('x2', dl.x2);
            line.setAttribute('y2', dl.y2);

            if (dl.isMain) {
                // Main lines: solid black
                line.setAttribute('stroke', this.colors.centerLine);
                line.setAttribute('stroke-width', this.s(cfg.strokeWidth));
            } else if (dl.isAuxiliary) {
                // Auxiliary lines (45°, 135°): dashed, slightly thinner
                line.setAttribute('stroke', this.colors.directionLine);
                line.setAttribute('stroke-width', this.s(cfg.strokeWidth * 0.9));
                line.setAttribute('stroke-dasharray', `${this.s(4)},${this.s(2)}`);
            } else {
                // Other lines
                line.setAttribute('stroke', this.colors.directionLine);
                line.setAttribute('stroke-width', this.s(cfg.thinStroke));
                line.setAttribute('stroke-dasharray', '3,2');
            }
            lineGroup.appendChild(line);
        }
        mainGroup.appendChild(lineGroup);

        // Angle labels - enable pointer events for dragging
        const labels = this.generateLabels();
        const labelGroup = document.createElementNS(ns, 'g');
        labelGroup.setAttribute('class', 'angle-labels');
        labelGroup.style.pointerEvents = 'auto';
        labelGroup.style.cursor = 'move';

        for (const label of labels) {
            const text = document.createElementNS(ns, 'text');
            text.setAttribute('x', label.x);
            text.setAttribute('y', label.y);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', label.isOuter ? this.s(8) : this.s(6.5));
            text.setAttribute('font-weight', label.isOuter ? 'normal' : 'normal');
            text.setAttribute('fill', label.isOuter ? this.colors.labelText : this.colors.innerLabelText);
            if (label.rotation !== 0) {
                text.setAttribute('transform', `rotate(${label.rotation}, ${label.x}, ${label.y})`);
            }
            text.textContent = label.text;
            labelGroup.appendChild(text);
        }
        mainGroup.appendChild(labelGroup);

        // Compass direction labels - enable pointer events for dragging
        const compassLabels = this.generateCompassLabels();
        const compassGroup = document.createElementNS(ns, 'g');
        compassGroup.setAttribute('class', 'compass-labels');
        compassGroup.style.pointerEvents = 'auto';
        compassGroup.style.cursor = 'move';

        for (const cl of compassLabels) {
            const text = document.createElementNS(ns, 'text');
            text.setAttribute('x', cl.x);
            text.setAttribute('y', cl.y);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', this.s(7));
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', cl.isInner ? this.colors.innerLabelText : this.colors.compassLabel);
            text.textContent = cl.text;
            compassGroup.appendChild(text);
        }
        mainGroup.appendChild(compassGroup);

        // Ruler scale on legs - enable pointer events for dragging
        const ruler = this.generateRulerScale();
        const rulerGroup = document.createElementNS(ns, 'g');
        rulerGroup.setAttribute('class', 'ruler-scale');
        rulerGroup.style.pointerEvents = 'stroke';
        rulerGroup.style.cursor = 'move';

        for (const tick of ruler.ticks) {
            const line = document.createElementNS(ns, 'line');
            line.setAttribute('x1', tick.x1);
            line.setAttribute('y1', tick.y1);
            line.setAttribute('x2', tick.x2);
            line.setAttribute('y2', tick.y2);
            line.setAttribute('stroke', this.colors.rulerLine);
            line.setAttribute('stroke-width', tick.isMajor ? this.s(cfg.strokeWidth) : this.s(cfg.thinStroke));
            rulerGroup.appendChild(line);
        }

        for (const label of ruler.labels) {
            const text = document.createElementNS(ns, 'text');
            text.setAttribute('x', label.x);
            text.setAttribute('y', label.y);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', this.s(7));
            text.setAttribute('fill', this.colors.labelText);
            text.textContent = label.text;
            rulerGroup.appendChild(text);
        }
        mainGroup.appendChild(rulerGroup);


        // Triangle name label (below the triangle)
        const nameLabel = document.createElementNS(ns, 'text');
        nameLabel.setAttribute('x', 0);
        nameLabel.setAttribute('y', this.s(25));
        nameLabel.setAttribute('text-anchor', 'middle');
        nameLabel.setAttribute('font-family', 'Arial, sans-serif');
        nameLabel.setAttribute('font-size', this.s(10));
        nameLabel.setAttribute('font-weight', 'bold');
        nameLabel.setAttribute('fill', this.colors.labelText);
        nameLabel.setAttribute('class', 'triangle-name');
        nameLabel.textContent = this.name;
        mainGroup.appendChild(nameLabel);

        svg.appendChild(mainGroup);

        this.svgElement = svg;
        this.groupElement = mainGroup;

        return svg;
    }

    /**
     * Update the position of the SVG element
     */
    updatePosition() {
        if (!this.svgElement) return;

        const width = parseFloat(this.svgElement.getAttribute('width'));
        const height = parseFloat(this.svgElement.getAttribute('height'));
        const halfHyp = this.s(this.config.hypotenuseLength) / 2;
        const triangleHeight = halfHyp;
        const padding = 40;

        // Position so that O (bottom vertex) is at (this.x, this.y)
        this.svgElement.style.left = `${this.x - width / 2}px`;
        this.svgElement.style.top = `${this.y - triangleHeight * 2 - padding}px`;
    }

    /**
     * Update the rotation transform
     */
    updateRotation() {
        if (!this.groupElement) return;

        // Rotate around midpoint of hypotenuse (0, -halfHyp) in local coordinates
        const halfHyp = this.s(this.config.hypotenuseLength) / 2;
        this.groupElement.setAttribute('transform', `rotate(${this.rotation}, 0, ${-halfHyp})`);

        // Update angle display — snap to nearest half-degree so free-form
        // drag rotations still read cleanly (e.g. "12.5°"), while whole
        // degrees render without a trailing ".0".
        const angleDisplay = this.svgElement.querySelector('.angle-display');
        if (angleDisplay) {
            const normalizedAngle = ((this.rotation % 360) + 360) % 360;
            const snapped = Math.round(normalizedAngle * 2) / 2;
            const label = snapped % 1 === 0 ? snapped.toFixed(0) : snapped.toFixed(1);
            angleDisplay.textContent = `${label}°`;
        }
    }

    /**
     * Set position (O = bottom vertex position)
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.updatePosition();
    }

    /**
     * Set rotation angle
     */
    setRotation(degrees) {
        this.rotation = degrees;
        this.updateRotation();
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
    startDrag(clientX, clientY) {
        this.isDragging = true;
        this.dragOffset = {
            x: clientX - this.x,
            y: clientY - this.y
        };
    }

    /**
     * Update drag position
     */
    updateDrag(clientX, clientY) {
        if (!this.isDragging) return false;

        this.x = clientX - this.dragOffset.x;
        this.y = clientY - this.dragOffset.y;
        this.updatePosition();
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
    startRotation(clientX, clientY) {
        this.isRotating = true;
        const halfHyp = this.s(this.config.hypotenuseLength) / 2;
        const pivotY = this.y - halfHyp;
        this.rotationStartAngle = Math.atan2(clientY - pivotY, clientX - this.x) * 180 / Math.PI;
    }

    /**
     * Update rotation by mouse position (incremental to avoid atan2 wrap-around jumps)
     */
    updateRotationByMouse(clientX, clientY) {
        if (!this.isRotating) return false;

        const halfHyp = this.s(this.config.hypotenuseLength) / 2;
        const pivotY = this.y - halfHyp;
        const currentAngle = Math.atan2(clientY - pivotY, clientX - this.x) * 180 / Math.PI;
        let delta = currentAngle - this.rotationStartAngle;
        // Normalize to [-180, 180] so crossing the ±180° boundary never causes a jump
        delta = ((delta + 180) % 360 + 360) % 360 - 180;
        this.rotation += delta;
        this.rotationStartAngle = currentAngle;
        this.updateRotation();
        return true;
    }

    /**
     * Stop rotation
     */
    stopRotation() {
        this.isRotating = false;
    }

    /**
     * Check if point is near the center O (rotation handle)
     */
    isNearCenter(clientX, clientY, threshold = null) {
        if (threshold === null) {
            // Use a minimum threshold so rotation works even with small triangles
            threshold = Math.max(35, this.s(40));
        }
        const dx = clientX - this.x;
        const dy = clientY - this.y;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
    }

    /**
     * Check if point is within the triangle bounds
     */
    containsPoint(clientX, clientY) {
        if (!this.svgElement) return false;

        const rect = this.svgElement.getBoundingClientRect();
        return clientX >= rect.left && clientX <= rect.right &&
               clientY >= rect.top && clientY <= rect.bottom;
    }

    /**
     * Highlight the triangle
     */
    setHighlight(enabled) {
        if (!this.svgElement) return;

        const trianglePath = this.svgElement.querySelector('path');
        if (trianglePath) {
            if (enabled) {
                trianglePath.setAttribute('stroke', this.colors.innerScale);
                trianglePath.setAttribute('stroke-width', this.s(this.config.strokeWidth * 2.5));
            } else {
                trianglePath.setAttribute('stroke', this.colors.stroke);
                trianglePath.setAttribute('stroke-width', this.s(this.config.strokeWidth * 1.5));
            }
        }
    }
}

/**
 * Manager for multiple plotting triangles
 */
class PlottingTriangleManager {
    constructor() {
        this.triangles = new Map();
        this.activeTriangle = null;
        this.selectedTriangle = null;  // persists after mouseup for arrow-key movement
        this.container = null;
        this.onChangeCallback = null;
        this.onSelectionChange = null; // callback(triangle|null) for map zoom control
        this.zKeyPressed = false;
        this.setupKeyboardListeners();
    }

    /**
     * Setup keyboard listeners for Z key (rotation) and arrow keys (movement)
     */
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
            this.selectedTriangle.updatePosition();
            this.notifyChange();
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

    /**
     * Set the container element for triangles
     */
    setContainer(container) {
        this.container = container;
    }

    /**
     * Set callback for angle changes
     */
    onChange(callback) {
        this.onChangeCallback = callback;
    }

    /**
     * Create a triangle and add it to the manager
     */
    createTriangle(id, name, x, y, scale = 1.0) {
        const triangle = new PlottingTriangle(id, name, scale);
        triangle.setPosition(x, y);

        const svg = triangle.createSVG();

        if (this.container) {
            this.container.appendChild(svg);
        }

        // setPosition() ran before createSVG() existed, so updatePosition()
        // bailed out early and never wrote left/top. Apply it now that the SVG
        // element is present, otherwise the triangle sits at the container
        // origin (both triangles stacked on top of each other) until the next
        // drag/resize event happens to call updatePosition().
        triangle.updatePosition();

        this.triangles.set(id, triangle);
        this.setupTriangleEventListeners(triangle);

        return triangle;
    }

    /**
     * Create a standard pair of triangles
     */
    createStandardPair(width, height, scale = 1.0) {
        // Stack both triangles in the central area, one below the other, so the
        // user finds them together and then drags them apart. The triangle body
        // extends upward from its O reference point (bottom vertex) by
        // hypotenuseLength / 2 (= 170 base units) × scale. Offsetting the two
        // O-points by half that height leaves them overlapping by ~50%.
        const triangleHeight = 170 * scale;
        const overlapOffset = triangleHeight * 0.5;
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        const triangleA = this.createTriangle(
            'triangleA',
            'Triangle A',
            centerX,
            centerY - overlapOffset / 2,
            scale
        );

        const triangleB = this.createTriangle(
            'triangleB',
            'Triangle B',
            centerX,
            centerY + overlapOffset / 2,
            scale
        );

        return { triangleA, triangleB };
    }

    /**
     * Setup event listeners for a triangle
     */
    setupTriangleEventListeners(triangle) {
        const svg = triangle.svgElement;
        if (!svg) return;

        // Mouse events
        svg.addEventListener('mousedown', (e) => this.handleMouseDown(e, triangle));

        // Touch events
        svg.addEventListener('touchstart', (e) => this.handleTouchStart(e, triangle), { passive: false });
    }

    /**
     * Handle mouse down on triangle
     */
    handleMouseDown(e, triangle) {
        e.preventDefault();
        e.stopPropagation();

        // Clean up any lingering state from previous interactions
        if (this.activeTriangle) {
            this.activeTriangle.stopDrag();
            this.activeTriangle.stopRotation();
            this.activeTriangle.setHighlight(false);
        }

        // Remove any existing document listeners (defensive cleanup)
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        // Reset both flags before starting new interaction
        triangle.isDragging = false;
        triangle.isRotating = false;

        const clientX = e.clientX;
        const clientY = e.clientY;

        // Bring triangle to front
        this.bringToFront(triangle);

        // Z key held = rotation mode, otherwise drag mode
        if (this.zKeyPressed) {
            triangle.startRotation(clientX, clientY);
            triangle.setHighlight(true);
        } else {
            triangle.startDrag(clientX, clientY);
            triangle.setHighlight(true);
        }

        this.activeTriangle = triangle;

        if (this.selectedTriangle !== triangle) {
            this.selectedTriangle = triangle;
            this.onSelectionChange?.(triangle);
        }

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    }

    /**
     * Handle touch start on triangle
     */
    handleTouchStart(e, triangle) {
        e.preventDefault();
        e.stopPropagation();

        // Clean up any lingering state from previous interactions
        if (this.activeTriangle) {
            this.activeTriangle.stopDrag();
            this.activeTriangle.stopRotation();
            this.activeTriangle.setHighlight(false);
        }

        // Remove any existing document listeners (defensive cleanup)
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);

        // Reset both flags before starting new interaction
        triangle.isDragging = false;
        triangle.isRotating = false;

        this.bringToFront(triangle);

        // Two-finger touch = rotation mode, single finger = drag mode
        if (e.touches.length === 2) {
            // Use midpoint of two touches for rotation
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const clientX = (touch1.clientX + touch2.clientX) / 2;
            const clientY = (touch1.clientY + touch2.clientY) / 2;
            triangle.startRotation(clientX, clientY);
            triangle.setHighlight(true);
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            const clientX = touch.clientX;
            const clientY = touch.clientY;
            triangle.startDrag(clientX, clientY);
            triangle.setHighlight(true);
        } else {
            return;
        }

        this.activeTriangle = triangle;

        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd);
    }

    /**
     * Handle mouse move
     */
    handleMouseMove = (e) => {
        if (!this.activeTriangle) return;

        // Coalesce rapid mousemove events into a single update per animation
        // frame. Each rotation/drag update re-applies a transform to a ~400-node
        // SVG group (protractor ticks/labels/ruler), which the browser repaints
        // on the CPU — far too heavy to run on every raw mousemove, since mice
        // fire well above the display refresh rate. requestAnimationFrame caps
        // the work to one repaint per frame and clears the event backlog that
        // caused the lag.
        this._pendingPointer = { x: e.clientX, y: e.clientY };

        if (this._moveFrame) return;
        this._moveFrame = requestAnimationFrame(() => {
            this._moveFrame = null;
            const p = this._pendingPointer;
            const t = this.activeTriangle;
            if (!p || !t) return;

            if (t.isRotating) {
                t.updateRotationByMouse(p.x, p.y);
            } else if (t.isDragging) {
                t.updateDrag(p.x, p.y);
            }

            this.notifyChange();
        });
    };

    /**
     * Handle mouse up
     */
    handleMouseUp = () => {
        // Drop any frame that was scheduled but not yet painted so it can't
        // fire after the interaction ends.
        if (this._moveFrame) {
            cancelAnimationFrame(this._moveFrame);
            this._moveFrame = null;
        }

        if (this.activeTriangle) {
            this.activeTriangle.stopDrag();
            this.activeTriangle.stopRotation();
            this.activeTriangle.setHighlight(false);
            this.activeTriangle = null;
        }

        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);

        this.notifyChange();
    };

    /**
     * Handle touch move
     */
    handleTouchMove = (e) => {
        if (!this.activeTriangle) return;

        e.preventDefault();

        if (this.activeTriangle.isRotating && e.touches.length >= 2) {
            // Two-finger rotation - use midpoint
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const clientX = (touch1.clientX + touch2.clientX) / 2;
            const clientY = (touch1.clientY + touch2.clientY) / 2;
            this.activeTriangle.updateRotationByMouse(clientX, clientY);
        } else if (this.activeTriangle.isDragging && e.touches.length === 1) {
            const touch = e.touches[0];
            const clientX = touch.clientX;
            const clientY = touch.clientY;
            this.activeTriangle.updateDrag(clientX, clientY);
        }

        this.notifyChange();
    };

    /**
     * Handle touch end
     */
    handleTouchEnd = () => {
        if (this.activeTriangle) {
            this.activeTriangle.stopDrag();
            this.activeTriangle.stopRotation();
            this.activeTriangle.setHighlight(false);
            this.activeTriangle = null;
        }

        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);

        this.notifyChange();
    };

    /**
     * Bring triangle to front
     */
    bringToFront(triangle) {
        if (!this.container || !triangle.svgElement) return;
        this.container.appendChild(triangle.svgElement);
    }

    /**
     * Notify about changes
     */
    notifyChange() {
        if (this.onChangeCallback) {
            const angles = this.getRotationAngles();
            this.onChangeCallback(angles);
        }
    }

    /**
     * Get rotation angles for all triangles
     */
    getRotationAngles() {
        const angles = {};
        for (const [id, triangle] of this.triangles) {
            angles[id] = triangle.getRotation();
        }
        return angles;
    }

    /**
     * Get a triangle by ID
     */
    getTriangle(id) {
        return this.triangles.get(id);
    }

    /**
     * Set rotation for a triangle
     */
    setTriangleRotation(id, degrees) {
        const triangle = this.triangles.get(id);
        if (triangle) {
            triangle.setRotation(degrees);
            this.notifyChange();
        }
    }

    /**
     * Remove a triangle
     */
    removeTriangle(id) {
        const triangle = this.triangles.get(id);
        if (triangle && triangle.svgElement) {
            triangle.svgElement.remove();
        }
        this.triangles.delete(id);
    }

    /**
     * Remove all triangles
     */
    removeAll() {
        for (const [id, triangle] of this.triangles) {
            if (triangle.svgElement) {
                triangle.svgElement.remove();
            }
        }
        this.triangles.clear();
    }

    /**
     * Show all triangles
     */
    showAll() {
        for (const [id, triangle] of this.triangles) {
            if (triangle.svgElement) {
                triangle.svgElement.style.display = 'block';
            }
        }
    }

    /**
     * Hide all triangles
     */
    hideAll() {
        for (const [id, triangle] of this.triangles) {
            if (triangle.svgElement) {
                triangle.svgElement.style.display = 'none';
            }
        }
    }

    /**
     * Update all triangle positions
     */
    updateAllPositions() {
        for (const [id, triangle] of this.triangles) {
            triangle.updatePosition();
        }
    }
}

// Export classes globally (for Leaflet/SVG-based usage)
window.PlottingTriangle = PlottingTriangle;
window.PlottingTriangleManager = PlottingTriangleManager;

// Backward compatibility for Leaflet integration only
window.NauticalTriangle = PlottingTriangle;
// Note: NauticalTriangleManager for canvas is defined in nautical_triangles_canvas.js
