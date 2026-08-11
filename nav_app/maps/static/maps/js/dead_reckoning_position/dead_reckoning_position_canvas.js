/**
 * Dead Reckoning Position Manager for Canvas-based Graticule System
 * Marks worked-out positions on the chart image
 * Icon: Circle with a dot inside (against the observed position's circle with
 * a cross) — the same pair of symbols the Leaflet sea map uses.
 *
 * The store, dragging, hit testing, geometry link and label all come from
 * core/canvas_marker_manager.js, shared with the observed position tool. What
 * lives here is what belongs to THIS kind: its symbol and its identity.
 */

/** Circle with a dot: the chart symbol for a dead reckoning position. */
function drawDeadReckoningSymbol(ctx, x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, radius * 0.24), 0, Math.PI * 2);
    ctx.fill();
}

class DeadReckoningPositionManagerCanvas extends CanvasMarkerManager {
    constructor(mapper) {
        super(mapper, {
            kindId: 'dr',
            title: 'Dead reckoning position',
            // Matches the blue of the Leaflet dead reckoning marker.
            color: '#1565C0',
            // Same size as the observed position symbol it pairs with.
            iconSize: 20,
            placementHint: 'Click to place dead reckoning position',
            drawSymbol: drawDeadReckoningSymbol,
        });
    }
}

// Export for use in enhanced graticule system
if (typeof window !== 'undefined') {
    window.DeadReckoningPositionManagerCanvas = DeadReckoningPositionManagerCanvas;
}
