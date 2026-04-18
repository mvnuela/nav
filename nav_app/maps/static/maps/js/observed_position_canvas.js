/**
 * Observed Position Manager for Canvas-based Graticule System
 * Allows marking observed positions (fixes) on the nautical map
 * Icon: Circle with X inside (classic navigation symbol for a fix)
 */

class ObservedPositionManagerCanvas {
    constructor(mapper) {
        this.mapper = mapper;
        this.positions = [];
        this.positionCounter = 0;
        this.selectedPosition = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.placementMode = false;

        this.iconSize = 48;
        this.iconColor = '#000';
        this.strokeWidth = 2;

        // Optional link to the geometry manager. When set, every observed
        // position is also registered as an "external" point in the geometry
        // store so the Connect / Ray / Delete tools can target it.
        this.geometryManager = null;
    }

    /**
     * Update mapper reference (when geographic bounds change)
     */
    setMapper(mapper) {
        this.mapper = mapper;
    }

    /**
     * Link this manager to the geometry manager. Back-fills external points
     * for any observed positions that were placed before the link was made.
     */
    setGeometryManager(geometryManager) {
        this.geometryManager = geometryManager;
        if (!geometryManager) return;
        for (const pos of this.positions) {
            if (pos.geometryPointId != null) continue;
            const pt = geometryManager.store.addPoint(pos.lat, pos.lon);
            pt.external = true;
            pos.geometryPointId = pt.id;
        }
    }

    /**
     * Start placement mode
     */
    startPlacement() {
        this.placementMode = true;
        this.selectedPosition = null;
    }

    /**
     * Cancel placement mode
     */
    cancelPlacement() {
        this.placementMode = false;
    }

    /**
     * Add observed position at canvas coordinates
     */
    addPosition(canvasX, canvasY) {
        if (!this.mapper) return null;

        // Convert to geographic coordinates
        const geo = this.mapper.screenToGeographic(canvasX, canvasY);

        this.positionCounter++;
        const position = {
            id: this.positionCounter,
            canvasX: canvasX,
            canvasY: canvasY,
            lat: geo.lat,
            lon: geo.lon,
            timestamp: new Date(),
            description: ''
        };

        this.positions.push(position);
        this.selectedPosition = position;
        this.placementMode = false;

        if (this.geometryManager) {
            const pt = this.geometryManager.store.addPoint(geo.lat, geo.lon);
            pt.external = true;
            position.geometryPointId = pt.id;
        }

        return position;
    }

    /**
     * Delete selected position
     */
    deleteSelected() {
        if (!this.selectedPosition) return false;

        const index = this.positions.findIndex(p => p.id === this.selectedPosition.id);
        if (index !== -1) {
            this._cascadeDeleteGeometry(this.positions[index]);
            this.positions.splice(index, 1);
            this.selectedPosition = null;
            return true;
        }
        return false;
    }

    /**
     * Delete position by ID
     */
    deleteById(id) {
        const index = this.positions.findIndex(p => p.id === id);
        if (index !== -1) {
            this._cascadeDeleteGeometry(this.positions[index]);
            if (this.selectedPosition && this.selectedPosition.id === id) {
                this.selectedPosition = null;
            }
            this.positions.splice(index, 1);
            return true;
        }
        return false;
    }

    _cascadeDeleteGeometry(pos) {
        if (!this.geometryManager || pos.geometryPointId == null) return;
        this.geometryManager.store.deletePoint(pos.geometryPointId);
    }

    /**
     * Set description (fraction string) on a position by id
     */
    setDescription(id, description) {
        const pos = this.positions.find(p => p.id === id);
        if (!pos) return false;
        pos.description = description || '';
        return true;
    }

    /**
     * Clear all positions
     */
    clearAll() {
        if (this.geometryManager) {
            for (const pos of this.positions) {
                if (pos.geometryPointId != null) {
                    this.geometryManager.store.deletePoint(pos.geometryPointId);
                }
            }
        }
        this.positions = [];
        this.selectedPosition = null;
        this.positionCounter = 0;
    }

    /**
     * Get all positions
     */
    getPositions() {
        return this.positions;
    }

    /**
     * Get selected position info
     */
    getSelectedInfo() {
        if (!this.selectedPosition) return null;

        return {
            id: this.selectedPosition.id,
            lat: this.selectedPosition.lat,
            lon: this.selectedPosition.lon,
            timestamp: this.selectedPosition.timestamp
        };
    }

    /**
     * Hit test for mouse interaction
     */
    hitTest(x, y) {
        const hitRadius = this.iconSize / 2 + 5;

        // Check positions in reverse order (most recent first)
        for (let i = this.positions.length - 1; i >= 0; i--) {
            const pos = this.positions[i];
            const dx = x - pos.canvasX;
            const dy = y - pos.canvasY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= hitRadius) {
                return pos;
            }
        }
        return null;
    }

    /**
     * Handle mouse down
     */
    handleMouseDown(x, y) {
        // If in placement mode, add new position
        if (this.placementMode) {
            this.addPosition(x, y);
            return true;
        }

        // When the geometry tool is in Connect / Ray / Delete mode, a click
        // on an observed position is interpreted as a point click for that
        // tool rather than a select/drag of the marker.
        const geom = this.geometryManager;
        if (geom && geom.isGeometryInteractionMode && geom.isGeometryInteractionMode()) {
            const hit = this.hitTest(x, y);
            if (hit && hit.geometryPointId != null) {
                if (geom.mode === 'delete') {
                    this.deleteById(hit.id);
                } else {
                    geom.handleExternalPointClick(hit.geometryPointId);
                }
                return true;
            }
            return false;
        }

        // Check for hit on existing position
        const hit = this.hitTest(x, y);
        if (hit) {
            this.selectedPosition = hit;
            this.isDragging = true;
            this.dragOffset = {
                x: x - hit.canvasX,
                y: y - hit.canvasY
            };
            return true;
        }

        // Deselect if clicking elsewhere
        if (this.selectedPosition) {
            this.selectedPosition = null;
            return true;
        }

        return false;
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(x, y) {
        if (this.isDragging && this.selectedPosition) {
            this.selectedPosition.canvasX = x - this.dragOffset.x;
            this.selectedPosition.canvasY = y - this.dragOffset.y;

            // Update geographic coordinates
            if (this.mapper) {
                const geo = this.mapper.screenToGeographic(
                    this.selectedPosition.canvasX,
                    this.selectedPosition.canvasY
                );
                this.selectedPosition.lat = geo.lat;
                this.selectedPosition.lon = geo.lon;

                // Keep the geometry-store point in sync so any Connect / Ray
                // lines attached to this observed position follow the drag.
                if (this.geometryManager && this.selectedPosition.geometryPointId != null) {
                    const pt = this.geometryManager.store.getPoint(this.selectedPosition.geometryPointId);
                    if (pt) {
                        pt.lat = geo.lat;
                        pt.lon = geo.lon;
                    }
                }
            }
            return true;
        }
        return false;
    }

    /**
     * Handle mouse up
     */
    handleMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            return true;
        }
        return false;
    }

    /**
     * Update cursor based on position
     */
    updateCursor(x, y) {
        if (this.placementMode) {
            return 'crosshair';
        }

        const hit = this.hitTest(x, y);
        if (hit) {
            const geom = this.geometryManager;
            if (geom && geom.isGeometryInteractionMode && geom.isGeometryInteractionMode()) {
                return 'pointer';
            }
            if (this.isDragging) {
                return 'grabbing';
            }
            return 'grab';
        }

        return 'default';
    }

    /**
     * Draw observed position icon (circle with X)
     */
    drawIcon(ctx, x, y, size, color, isSelected) {
        ctx.save();

        const strokeWidth = isSelected ? 3 : 2;
        const radius = size / 2 - strokeWidth;

        // Draw selection highlight
        if (isSelected) {
            ctx.fillStyle = 'rgba(255, 193, 7, 0.3)';
            ctx.beginPath();
            ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw circle
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw X
        const offset = radius * 0.6;
        ctx.beginPath();
        ctx.moveTo(x - offset, y - offset);
        ctx.lineTo(x + offset, y + offset);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + offset, y - offset);
        ctx.lineTo(x - offset, y + offset);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Draw all positions
     */
    drawAll(ctx) {
        // Draw all positions
        for (const pos of this.positions) {
            const isSelected = this.selectedPosition && this.selectedPosition.id === pos.id;
            this.drawIcon(ctx, pos.canvasX, pos.canvasY, this.iconSize, this.iconColor, isSelected);

            // Draw label for selected position
            if (isSelected) {
                this.drawLabel(ctx, pos);
            }
        }

        // Draw placement preview cursor
        if (this.placementMode) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#0078A8';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Click to place observed position', ctx.canvas.width / 2, 30);
            ctx.restore();
        }
    }

    /**
     * Draw label for position
     */
    drawLabel(ctx, pos) {
        ctx.save();

        const latStr = typeof decimalToNautical === 'function'
            ? decimalToNautical(pos.lat, true)
            : pos.lat.toFixed(4);
        const lonStr = typeof decimalToNautical === 'function'
            ? decimalToNautical(pos.lon, false)
            : pos.lon.toFixed(4);
        const timeStr = pos.timestamp.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const label = `#${pos.id} | ${latStr}, ${lonStr} | ${timeStr}`;

        ctx.font = 'bold 11px Arial';
        const metrics = ctx.measureText(label);
        const padding = 6;
        const labelWidth = metrics.width + padding * 2;
        const labelHeight = 20;

        const labelX = pos.canvasX - labelWidth / 2;
        const labelY = pos.canvasY - this.iconSize - 8;

        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(labelX, labelY - labelHeight, labelWidth, labelHeight);

        // Border
        ctx.strokeStyle = '#0078A8';
        ctx.lineWidth = 1;
        ctx.strokeRect(labelX, labelY - labelHeight, labelWidth, labelHeight);

        // Text
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pos.canvasX, labelY - labelHeight / 2);

        ctx.restore();
    }

    /**
     * Update all positions' canvas coordinates from geographic coordinates
     * (Called when map bounds change)
     */
    updateCanvasCoordinates() {
        if (!this.mapper) return;

        for (const pos of this.positions) {
            const screen = this.mapper.geographicToScreen(pos.lat, pos.lon);
            pos.canvasX = screen.x;
            pos.canvasY = screen.y;
        }
    }
}

// Export for use in enhanced graticule system
if (typeof window !== 'undefined') {
    window.ObservedPositionManagerCanvas = ObservedPositionManagerCanvas;
}
