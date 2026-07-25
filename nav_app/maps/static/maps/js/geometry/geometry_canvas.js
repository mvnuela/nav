/**
 * Geometry Manager for Canvas-based Graticule System
 * Manages interactive points, connections (line segments), and rays (half-lines)
 * Pattern: matches ObservedPositionManagerCanvas
 */

class GeometryManagerCanvas {
    constructor(mapper) {
        this.mapper = mapper;
        this.store = new GeometryStore();

        // Interaction modes: 'none', 'place_point', 'connect', 'ray', 'delete'
        this.mode = 'none';

        // For connect/ray: first selected point awaiting second click
        this.pendingFirstPointId = null;

        // Visual settings
        this.pointRadius = 8;
        this.colors = {
            point: '#E91E63',
            pointSelected: '#FF5722',
            connection: '#2196F3',
            connectionSelected: '#1565C0',
            ray: '#FF9800',
            raySelected: '#E65100',
            pendingHighlight: 'rgba(255, 193, 7, 0.5)',
            selectionGlow: 'rgba(255, 193, 7, 0.4)'
        };

        // Hit testing tolerance
        this.hitTolerance = 8;

        // Callback for state changes (to update UI)
        this.onStateChange = null;

        // Cursor preview state for "place_point" mode
        this.previewMouse = { x: 0, y: 0, visible: false };
    }

    setMapper(mapper) {
        this.mapper = mapper;
    }

    setMode(mode) {
        this.mode = mode;
        this.pendingFirstPointId = null;
        this.store.clearSelection();
        if (mode !== 'place_point') {
            this.previewMouse.visible = false;
        }
        this.onStateChange?.();
    }

    hidePreviewMouse() {
        this.previewMouse.visible = false;
    }

    // ——— Hit Testing ———

    _pointScreenPos(pt) {
        if (!this.mapper) return null;
        return this.mapper.geographicToScreen(pt.lat, pt.lon);
    }

    hitTestPoint(x, y) {
        const hitRadius = this.pointRadius + this.hitTolerance;
        for (let i = this.store.points.length - 1; i >= 0; i--) {
            const pt = this.store.points[i];
            // External points (e.g. observed positions) are owned and hit-tested
            // by their original manager; skip them here so geometry interactions
            // don't fight with the observed-position X icon.
            if (pt.external) continue;
            const screen = this._pointScreenPos(pt);
            if (!screen) continue;
            const dx = x - screen.x;
            const dy = y - screen.y;
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                return pt;
            }
        }
        return null;
    }

    _distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
        let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = ax + t * dx;
        const projY = ay + t * dy;
        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    hitTestConnection(x, y) {
        for (let i = this.store.connections.length - 1; i >= 0; i--) {
            const conn = this.store.connections[i];
            const ptA = this.store.getPoint(conn.pointAId);
            const ptB = this.store.getPoint(conn.pointBId);
            if (!ptA || !ptB) continue;
            const sA = this._pointScreenPos(ptA);
            const sB = this._pointScreenPos(ptB);
            if (!sA || !sB) continue;
            const dist = this._distToSegment(x, y, sA.x, sA.y, sB.x, sB.y);
            if (dist <= this.hitTolerance) return conn;
        }
        return null;
    }

    _distToRay(px, py, ox, oy, tx, ty) {
        const dx = tx - ox;
        const dy = ty - oy;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px - ox) ** 2 + (py - oy) ** 2);
        // Project onto ray (t >= 0 only, no upper bound)
        let t = ((px - ox) * dx + (py - oy) * dy) / lenSq;
        t = Math.max(0, t);
        const projX = ox + t * dx;
        const projY = oy + t * dy;
        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    hitTestRay(x, y) {
        for (let i = this.store.rays.length - 1; i >= 0; i--) {
            const ray = this.store.rays[i];
            const origin = this.store.getPoint(ray.originPointId);
            const through = this.store.getPoint(ray.throughPointId);
            if (!origin || !through) continue;
            const sO = this._pointScreenPos(origin);
            const sT = this._pointScreenPos(through);
            if (!sO || !sT) continue;
            const dist = this._distToRay(x, y, sO.x, sO.y, sT.x, sT.y);
            if (dist <= this.hitTolerance) return ray;
        }
        return null;
    }

    // ——— Mouse Handlers ———

    handleMouseDown(x, y) {
        if (this.mode === 'place_point') {
            return this._handlePlacePoint(x, y);
        }
        if (this.mode === 'connect') {
            return this._handleConnectClick(x, y);
        }
        if (this.mode === 'ray') {
            return this._handleRayClick(x, y);
        }
        if (this.mode === 'delete') {
            return this._handleDeleteClick(x, y);
        }
        // Default: selection
        return this._handleSelectionClick(x, y);
    }

    handleMouseMove(x, y) {
        if (this.mode === 'place_point') {
            this.previewMouse.x = x;
            this.previewMouse.y = y;
            this.previewMouse.visible = true;
            // return true so enhanced_graticule re-renders the canvas and the
            // preview stays in sync with the pointer
            return true;
        }
        return false;
    }

    handleMouseUp() {
        return false;
    }

    updateCursor(x, y) {
        if (this.mode === 'place_point') return 'crosshair';
        if (this.mode === 'delete') {
            const hitPt = this.hitTestPoint(x, y);
            const hitConn = !hitPt ? this.hitTestConnection(x, y) : null;
            const hitRay = (!hitPt && !hitConn) ? this.hitTestRay(x, y) : null;
            return (hitPt || hitConn || hitRay) ? 'pointer' : 'default';
        }
        if (this.mode === 'connect' || this.mode === 'ray') {
            const hitPt = this.hitTestPoint(x, y);
            return hitPt ? 'pointer' : 'default';
        }
        // Selection mode
        const hitPt = this.hitTestPoint(x, y);
        const hitConn = !hitPt ? this.hitTestConnection(x, y) : null;
        const hitRay = (!hitPt && !hitConn) ? this.hitTestRay(x, y) : null;
        return (hitPt || hitConn || hitRay) ? 'pointer' : 'default';
    }

    // ——— Mode Handlers ———

    _handlePlacePoint(x, y) {
        if (!this.mapper) return false;
        const geo = this.mapper.screenToGeographic(x, y);
        this.store.addPoint(geo.lat, geo.lon);
        // One-shot: disarm after a single placement so the next canvas click
        // can't accidentally place more points. setMode('none') also fires
        // onStateChange, so the panel resyncs.
        this.setMode('none');
        return true;
    }

    _handleConnectClick(x, y) {
        const hitPt = this.hitTestPoint(x, y);
        if (!hitPt) return false;

        if (this.pendingFirstPointId === null) {
            this.pendingFirstPointId = hitPt.id;
            this.onStateChange?.();
            return true;
        }

        if (hitPt.id === this.pendingFirstPointId) return true;

        this.store.addConnection(this.pendingFirstPointId, hitPt.id);
        // One-shot: the connection is complete, disarm back to idle.
        this.setMode('none');
        return true;
    }

    _handleRayClick(x, y) {
        const hitPt = this.hitTestPoint(x, y);
        if (!hitPt) return false;

        if (this.pendingFirstPointId === null) {
            this.pendingFirstPointId = hitPt.id;
            this.onStateChange?.();
            return true;
        }

        if (hitPt.id === this.pendingFirstPointId) return true;

        this.store.addRay(this.pendingFirstPointId, hitPt.id);
        // One-shot: the ray is complete, disarm back to idle.
        this.setMode('none');
        return true;
    }

    _handleDeleteClick(x, y) {
        // Priority: points first, then connections, then rays
        const hitPt = this.hitTestPoint(x, y);
        if (hitPt) {
            this.store.deletePoint(hitPt.id);
            // One-shot: disarm after a single deletion.
            this.setMode('none');
            return true;
        }

        const hitConn = this.hitTestConnection(x, y);
        if (hitConn) {
            this.store.deleteConnection(hitConn.id);
            this.setMode('none');
            return true;
        }

        const hitRay = this.hitTestRay(x, y);
        if (hitRay) {
            this.store.deleteRay(hitRay.id);
            this.setMode('none');
            return true;
        }

        return false;
    }

    // Entry point for clicks on points managed externally (e.g. observed
    // positions). We already know which point was hit — skip hit-testing and
    // run the same connect/ray logic as an internal point click.
    handleExternalPointClick(pointId) {
        const pt = this.store.getPoint(pointId);
        if (!pt) return false;

        if (this.mode === 'connect' || this.mode === 'ray') {
            if (this.pendingFirstPointId === null) {
                this.pendingFirstPointId = pointId;
                this.onStateChange?.();
                return true;
            }
            if (pointId === this.pendingFirstPointId) return true;
            if (this.mode === 'connect') {
                this.store.addConnection(this.pendingFirstPointId, pointId);
            } else {
                this.store.addRay(this.pendingFirstPointId, pointId);
            }
            // One-shot: the shape is complete, disarm back to idle.
            this.setMode('none');
            return true;
        }
        return false;
    }

    isGeometryInteractionMode() {
        return this.mode === 'connect' || this.mode === 'ray' || this.mode === 'delete';
    }

    _handleSelectionClick(x, y) {
        this.store.clearSelection();

        const hitPt = this.hitTestPoint(x, y);
        if (hitPt) {
            hitPt.selected = true;
            this.onStateChange?.();
            return true;
        }

        const hitConn = this.hitTestConnection(x, y);
        if (hitConn) {
            hitConn.selected = true;
            this.onStateChange?.();
            return true;
        }

        const hitRay = this.hitTestRay(x, y);
        if (hitRay) {
            hitRay.selected = true;
            this.onStateChange?.();
            return true;
        }

        return false;
    }

    // ——— Drawing ———

    drawAll(ctx) {
        if (!this.mapper) return;

        this._drawConnections(ctx);
        this._drawRays(ctx);
        this._drawPoints(ctx);
        this._drawModeOverlay(ctx);
        this._drawPlacePreview(ctx);
    }

    _drawPlacePreview(ctx) {
        if (this.mode !== 'place_point') return;
        if (!this.previewMouse.visible) return;

        const { x, y } = this.previewMouse;
        ctx.save();
        ctx.fillStyle = 'rgba(233, 30, 99, 0.18)';
        ctx.strokeStyle = 'rgba(233, 30, 99, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Tiny center dot at the exact click point
        ctx.fillStyle = 'rgba(233, 30, 99, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawPoints(ctx) {
        for (const pt of this.store.points) {
            // External points are drawn by their owning manager (e.g. the
            // observed-position X icon). Skip them to avoid double-drawing.
            if (pt.external) continue;
            const screen = this._pointScreenPos(pt);
            if (!screen) continue;

            const isPending = pt.id === this.pendingFirstPointId;
            const isSelected = pt.selected;

            // Selection/pending glow
            if (isSelected || isPending) {
                ctx.save();
                ctx.fillStyle = isPending ? this.colors.pendingHighlight : this.colors.selectionGlow;
                ctx.beginPath();
                ctx.arc(screen.x, screen.y, this.pointRadius + 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // Point circle
            ctx.save();
            ctx.fillStyle = isSelected ? this.colors.pointSelected : this.colors.point;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, this.pointRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Label
            ctx.fillStyle = '#333';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`P${pt.id}`, screen.x, screen.y - this.pointRadius - 4);
            ctx.restore();
        }
    }

    _drawConnections(ctx) {
        for (const conn of this.store.connections) {
            const ptA = this.store.getPoint(conn.pointAId);
            const ptB = this.store.getPoint(conn.pointBId);
            if (!ptA || !ptB) continue;
            const sA = this._pointScreenPos(ptA);
            const sB = this._pointScreenPos(ptB);
            if (!sA || !sB) continue;

            ctx.save();
            ctx.strokeStyle = conn.selected ? this.colors.connectionSelected : this.colors.connection;
            ctx.lineWidth = conn.selected ? 4 : 2.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(sA.x, sA.y);
            ctx.lineTo(sB.x, sB.y);
            ctx.stroke();
            ctx.restore();
        }
    }

    _drawRays(ctx) {
        const canvasW = ctx.canvas.width;
        const canvasH = ctx.canvas.height;
        const maxDist = Math.sqrt(canvasW * canvasW + canvasH * canvasH);

        for (const ray of this.store.rays) {
            const origin = this.store.getPoint(ray.originPointId);
            const through = this.store.getPoint(ray.throughPointId);
            if (!origin || !through) continue;
            const sO = this._pointScreenPos(origin);
            const sT = this._pointScreenPos(through);
            if (!sO || !sT) continue;

            const dx = sT.x - sO.x;
            const dy = sT.y - sO.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            const ux = dx / len;
            const uy = dy / len;
            const endX = sO.x + ux * maxDist;
            const endY = sO.y + uy * maxDist;

            ctx.save();
            ctx.strokeStyle = ray.selected ? this.colors.raySelected : this.colors.ray;
            ctx.lineWidth = ray.selected ? 3.5 : 2;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(sO.x, sO.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }

    _drawModeOverlay(ctx) {
        let text = null;
        if (this.mode === 'place_point') {
            text = 'Click to place a point';
        } else if (this.mode === 'connect') {
            text = this.pendingFirstPointId ? 'Click second point to connect' : 'Click first point to connect';
        } else if (this.mode === 'ray') {
            text = this.pendingFirstPointId ? 'Click second point for ray direction' : 'Click origin point for ray';
        } else if (this.mode === 'delete') {
            text = 'Click element to delete';
        }

        if (text) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#333';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(text, ctx.canvas.width / 2, 30);
            ctx.restore();
        }
    }

    /**
     * Update screen coordinates from geographic (called when map bounds change)
     * Not strictly needed since we recompute from geo each frame in drawAll,
     * but provided for API consistency with ObservedPositionManagerCanvas.
     */
    updateCanvasCoordinates() {
        // No-op: we always compute screen positions from geo coords in drawAll
    }

    getStatusText() {
        const p = this.store.points.length;
        const c = this.store.connections.length;
        const r = this.store.rays.length;
        return `${p} point${p !== 1 ? 's' : ''}, ${c} connection${c !== 1 ? 's' : ''}, ${r} ray${r !== 1 ? 's' : ''}`;
    }
}

if (typeof window !== 'undefined') {
    window.GeometryManagerCanvas = GeometryManagerCanvas;
}
