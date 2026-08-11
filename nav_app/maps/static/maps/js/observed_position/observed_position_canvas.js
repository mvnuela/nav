/**
 * Observed Position Manager for Canvas-based Graticule System
 * Allows marking observed positions (fixes) on the nautical map
 * Icon: Circle with X inside (classic navigation symbol for a fix)
 *
 * The store, dragging, hit testing, geometry link and label all come from
 * core/canvas_marker_manager.js, shared with the dead reckoning tool. What
 * lives here is what belongs to THIS kind: its symbol and its identity.
 */

/** Circle with a cross: the chart symbol for an observed position. */
function drawObservedPositionSymbol(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    const offset = radius * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - offset, y - offset);
    ctx.lineTo(x + offset, y + offset);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + offset, y - offset);
    ctx.lineTo(x - offset, y + offset);
    ctx.stroke();
}

class ObservedPositionManagerCanvas extends CanvasMarkerManager {
    constructor(mapper) {
        super(mapper, {
            kindId: 'observed',
            title: 'Observed position',
            color: '#000',
            // Sized down from the original 48: the symbol covered too much
            // chart around the point it marks. Now matches the 20px marker the
            // Leaflet sea map draws.
            iconSize: 20,
            placementHint: 'Click to place observed position',
            drawSymbol: drawObservedPositionSymbol,
        });
    }
}

// Export for use in enhanced graticule system
if (typeof window !== 'undefined') {
    window.ObservedPositionManagerCanvas = ObservedPositionManagerCanvas;
}
