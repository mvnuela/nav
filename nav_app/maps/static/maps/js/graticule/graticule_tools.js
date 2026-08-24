/**
 * Graticule Tool Integration Methods
 * Extends EnhancedGraticuleSystem prototype with nautical tool management:
 * triangles, dividers, GPX routes, observed positions, geometry
 */

// ——— Nautical Triangles ———

EnhancedGraticuleSystem.prototype.initTriangles = function() {
    if (!this.triangleManager) {
        this.triangleManager = new NauticalTriangleManager();
        // Larger default so degree scale is legible out of the box, but cap
        // so both triangles still fit side-by-side on small canvases.
        // Sized against the chart, not the canvas: triangles are drawn inside
        // the render transform, so their coordinates are chart pixels. The
        // canvas is the panel and is usually smaller.
        const extent = this.uploadedImage || this.canvas;
        const baseline = Math.min(extent.width, extent.height) * 0.38;
        const triangleSize = Math.max(500, Math.min(baseline, 1000));
        this.triangleManager.createStandardPair(
            extent.width,
            extent.height,
            triangleSize
        );
        // Redraw canvas whenever arrow keys reposition a triangle
        this.triangleManager.onPositionChange = () => this.render();
    }
    return this.triangleManager;
};

EnhancedGraticuleSystem.prototype.toggleTriangles = function() {
    if (!this.triangleManager) {
        this.initTriangles();
    }
    this.trianglesVisible = !this.trianglesVisible;
    this.render();
    return this.trianglesVisible;
};

EnhancedGraticuleSystem.prototype.showTriangles = function() {
    if (!this.triangleManager) {
        this.initTriangles();
    }
    this.trianglesVisible = true;
    this.render();
};

EnhancedGraticuleSystem.prototype.hideTriangles = function() {
    this.trianglesVisible = false;
    this.render();
};

EnhancedGraticuleSystem.prototype.getTriangleAngles = function() {
    if (this.triangleManager) {
        return this.triangleManager.getRotationAngles();
    }
    return null;
};

EnhancedGraticuleSystem.prototype.resizeTriangles = function(newSize) {
    if (!this.triangleManager) return;

    // Recreate each triangle at same position/rotation but with new size
    const entries = [];
    for (const [id, tri] of this.triangleManager.triangles) {
        entries.push({ id, name: tri.name, x: tri.x, y: tri.y, rotation: tri.rotation });
    }

    this.triangleManager.removeAll();

    for (const e of entries) {
        const tri = this.triangleManager.createTriangle(e.id, e.name, e.x, e.y, newSize);
        tri.setRotation(e.rotation);
    }

    this.triangleManager.onPositionChange = () => this.render();
    this.render();
};

// ——— Nautical Divider ———

EnhancedGraticuleSystem.prototype.initDivider = function() {
    if (!this.dividerManager && this.mapper) {
        this.dividerManager = new NauticalDividerManager(
            this.mapper,
            this.projection
        );
    }
    return this.dividerManager;
};

EnhancedGraticuleSystem.prototype.toggleDivider = function() {
    if (!this.dividerManager) {
        this.initDivider();
    }
    this.dividerVisible = !this.dividerVisible;
    this.render();
    return this.dividerVisible;
};

EnhancedGraticuleSystem.prototype.showDivider = function() {
    if (!this.dividerManager) {
        this.initDivider();
    }
    this.dividerVisible = true;
    this.render();
};

EnhancedGraticuleSystem.prototype.hideDivider = function() {
    this.dividerVisible = false;
    if (this.dividerManager) {
        this.dividerManager.cancelPlacement();
    }
    this.render();
};

EnhancedGraticuleSystem.prototype.startDividerPlacement = function() {
    if (!this.dividerManager) {
        this.initDivider();
    }
    if (!this.dividerVisible) {
        this.dividerVisible = true;
    }
    this.dividerManager.startPlacement();
    this.render();
};

EnhancedGraticuleSystem.prototype.cancelDividerPlacement = function() {
    if (this.dividerManager) {
        this.dividerManager.cancelPlacement();
    }
    this.render();
};

EnhancedGraticuleSystem.prototype.deleteSelectedDivider = function() {
    if (this.dividerManager) {
        const deleted = this.dividerManager.deleteSelected();
        if (deleted) {
            this.render();
        }
        return deleted;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.clearAllDividers = function() {
    if (this.dividerManager) {
        this.dividerManager.clearAll();
        this.render();
    }
};

EnhancedGraticuleSystem.prototype.getSelectedDividerInfo = function() {
    if (this.dividerManager) {
        return this.dividerManager.getSelectedInfo();
    }
    return null;
};

// ——— GPX Routes ———

EnhancedGraticuleSystem.prototype.initGPXRoutes = function() {
    if (!this.gpxManager) {
        this.gpxManager = new GPXRoutesManagerCanvas();
    }
    return this.gpxManager;
};

EnhancedGraticuleSystem.prototype.toggleGPXRoutes = function() {
    if (!this.gpxManager) {
        this.initGPXRoutes();
    }
    this.gpxVisible = !this.gpxVisible;
    this.render();
    return this.gpxVisible;
};

EnhancedGraticuleSystem.prototype.showGPXRoutes = function() {
    if (!this.gpxManager) {
        this.initGPXRoutes();
    }
    this.gpxVisible = true;
    this.render();
};

EnhancedGraticuleSystem.prototype.hideGPXRoutes = function() {
    this.gpxVisible = false;
    this.render();
};

EnhancedGraticuleSystem.prototype.loadGPXFile = async function(file) {
    if (!this.gpxManager) {
        this.initGPXRoutes();
    }
    if (!this.mapper) {
        throw new Error('Please apply geographic bounds before loading GPX files');
    }

    try {
        const gpxData = await this.gpxManager.loadGPXFile(file);

        // Auto-show GPX routes
        if (!this.gpxVisible) {
            this.gpxVisible = true;
        }

        this.render();
        return gpxData;
    } catch (error) {
        throw error;
    }
};

EnhancedGraticuleSystem.prototype.toggleGPXRoute = function(routeId) {
    if (this.gpxManager) {
        const visible = this.gpxManager.toggleRoute(routeId);
        this.render();
        return visible;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.removeGPXRoute = function(routeId) {
    if (this.gpxManager) {
        const removed = this.gpxManager.removeRoute(routeId);
        if (removed) {
            this.render();
        }
        return removed;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.clearAllGPXRoutes = function() {
    if (this.gpxManager) {
        this.gpxManager.clearAll();
        this.render();
    }
};

EnhancedGraticuleSystem.prototype.fitToGPXRoutes = function() {
    if (!this.gpxManager || !this.mapper) return;

    const bounds = this.gpxManager.getAllBounds();
    if (bounds) {
        this.setGeographicBounds(
            bounds.minLat,
            bounds.maxLat,
            bounds.minLon,
            bounds.maxLon,
            { latInterval: this.latInterval, lonInterval: this.lonInterval }
        );
    }
};

EnhancedGraticuleSystem.prototype.getGPXRoutes = function() {
    return this.gpxManager ? this.gpxManager.routes : [];
};

// ——— Observed Positions ———

EnhancedGraticuleSystem.prototype.initObservedPosition = function() {
    if (!this.observedPositionManager && this.mapper) {
        this.observedPositionManager = new ObservedPositionManagerCanvas(this.mapper);
    }
    // Re-applying geographic bounds builds a new mapper; a manager made before
    // that would keep projecting through the old one.
    if (this.observedPositionManager && this.mapper) {
        this.observedPositionManager.setMapper(this.mapper);
    }
    // Link to geometry if it's already around so Connect / Ray can target
    // observed positions. The reverse link happens in initGeometry().
    if (this.observedPositionManager && this.geometryManager) {
        this.observedPositionManager.setGeometryManager(this.geometryManager);
    }
    return this.observedPositionManager;
};

EnhancedGraticuleSystem.prototype.toggleObservedPosition = function() {
    if (!this.observedPositionManager) {
        this.initObservedPosition();
    }
    this.observedPositionVisible = !this.observedPositionVisible;
    this.render();
    return this.observedPositionVisible;
};

EnhancedGraticuleSystem.prototype.showObservedPositions = function() {
    if (!this.observedPositionManager) {
        this.initObservedPosition();
    }
    this.observedPositionVisible = true;
    this.render();
};

EnhancedGraticuleSystem.prototype.hideObservedPositions = function() {
    this.observedPositionVisible = false;
    if (this.observedPositionManager) {
        this.observedPositionManager.cancelPlacement();
    }
    this.render();
};

EnhancedGraticuleSystem.prototype.startObservedPositionPlacement = function() {
    if (!this.observedPositionManager) {
        this.initObservedPosition();
    }
    if (!this.observedPositionVisible) {
        this.observedPositionVisible = true;
    }
    this.observedPositionManager.startPlacement();
    this.render();
};

EnhancedGraticuleSystem.prototype.cancelObservedPositionPlacement = function() {
    if (this.observedPositionManager) {
        this.observedPositionManager.cancelPlacement();
    }
    this.render();
};

EnhancedGraticuleSystem.prototype.deleteSelectedObservedPosition = function() {
    if (this.observedPositionManager) {
        const deleted = this.observedPositionManager.deleteSelected();
        if (deleted) {
            this.render();
        }
        return deleted;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.deleteObservedPositionById = function(id) {
    if (this.observedPositionManager) {
        const deleted = this.observedPositionManager.deleteById(id);
        if (deleted) {
            this.render();
        }
        return deleted;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.setObservedPositionDescription = function(id, description) {
    if (this.observedPositionManager) {
        const ok = this.observedPositionManager.setDescription(id, description);
        if (ok) {
            this.render();
        }
        return ok;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.clearAllObservedPositions = function() {
    if (this.observedPositionManager) {
        this.observedPositionManager.clearAll();
        this.render();
    }
};

EnhancedGraticuleSystem.prototype.getObservedPositions = function() {
    return this.observedPositionManager ? this.observedPositionManager.getPositions() : [];
};

EnhancedGraticuleSystem.prototype.getSelectedObservedPositionInfo = function() {
    if (this.observedPositionManager) {
        return this.observedPositionManager.getSelectedInfo();
    }
    return null;
};

EnhancedGraticuleSystem.prototype.isObservedPositionPlacementMode = function() {
    return this.observedPositionManager ? this.observedPositionManager.placementMode : false;
};

// ——— Dead Reckoning Positions ———
// The same set of operations as the observed positions above; both tools are
// the same manager with a different symbol (see core/canvas_marker_manager.js).

EnhancedGraticuleSystem.prototype.initDeadReckoning = function() {
    if (!this.drPositionManager && this.mapper) {
        this.drPositionManager = new DeadReckoningPositionManagerCanvas(this.mapper);
    }
    if (this.drPositionManager && this.mapper) {
        this.drPositionManager.setMapper(this.mapper);
    }
    if (this.drPositionManager && this.geometryManager) {
        this.drPositionManager.setGeometryManager(this.geometryManager);
    }
    return this.drPositionManager;
};

EnhancedGraticuleSystem.prototype.toggleDeadReckoning = function() {
    if (!this.drPositionManager) {
        this.initDeadReckoning();
    }
    this.drPositionVisible = !this.drPositionVisible;
    this.render();
    return this.drPositionVisible;
};

EnhancedGraticuleSystem.prototype.showDeadReckoning = function() {
    if (!this.drPositionManager) {
        this.initDeadReckoning();
    }
    this.drPositionVisible = true;
    this.render();
};

EnhancedGraticuleSystem.prototype.hideDeadReckoning = function() {
    this.drPositionVisible = false;
    if (this.drPositionManager) {
        this.drPositionManager.cancelPlacement();
    }
    this.render();
};

EnhancedGraticuleSystem.prototype.startDeadReckoningPlacement = function() {
    if (!this.drPositionManager) {
        this.initDeadReckoning();
    }
    if (!this.drPositionVisible) {
        this.drPositionVisible = true;
    }
    this.drPositionManager.startPlacement();
    this.render();
};

EnhancedGraticuleSystem.prototype.cancelDeadReckoningPlacement = function() {
    if (this.drPositionManager) {
        this.drPositionManager.cancelPlacement();
    }
    this.render();
};

EnhancedGraticuleSystem.prototype.deleteSelectedDeadReckoning = function() {
    if (this.drPositionManager) {
        const deleted = this.drPositionManager.deleteSelected();
        if (deleted) {
            this.render();
        }
        return deleted;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.deleteDeadReckoningById = function(id) {
    if (this.drPositionManager) {
        const deleted = this.drPositionManager.deleteById(id);
        if (deleted) {
            this.render();
        }
        return deleted;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.setDeadReckoningDescription = function(id, description) {
    if (this.drPositionManager) {
        const ok = this.drPositionManager.setDescription(id, description);
        if (ok) {
            this.render();
        }
        return ok;
    }
    return false;
};

EnhancedGraticuleSystem.prototype.clearAllDeadReckoning = function() {
    if (this.drPositionManager) {
        this.drPositionManager.clearAll();
        this.render();
    }
};

EnhancedGraticuleSystem.prototype.getDeadReckoningPositions = function() {
    return this.drPositionManager ? this.drPositionManager.getPositions() : [];
};

EnhancedGraticuleSystem.prototype.getSelectedDeadReckoningInfo = function() {
    if (this.drPositionManager) {
        return this.drPositionManager.getSelectedInfo();
    }
    return null;
};

EnhancedGraticuleSystem.prototype.isDeadReckoningPlacementMode = function() {
    return this.drPositionManager ? this.drPositionManager.placementMode : false;
};

// ——— Marking from typed coordinates ———

/**
 * Mark a point of a chosen kind at typed coordinates, mirroring the sea map's
 * "Go to Position" box. Deliberately does NOT move or zoom the view.
 *
 * @param {'observed'|'dr'|'plain'} kind
 * @returns {{ok:boolean, error:string|undefined}}
 */
EnhancedGraticuleSystem.prototype.markAtCoordinates = function(kind, lat, lon) {
    if (!this.mapper) {
        return { ok: false, error: 'apply geographic bounds first' };
    }

    // The projection extrapolates happily past the fitted region, so a typed
    // position from outside the chart would be placed somewhere off the image
    // rather than refused.
    const b = this.geoBounds;
    if (b && (lat < b.minLat || lat > b.maxLat || lon < b.minLon || lon > b.maxLon)) {
        return { ok: false, error: 'that position is outside the chart bounds' };
    }

    if (kind === 'plain') {
        const geometry = this.initGeometry();
        if (!geometry) return { ok: false, error: 'geometry tool is not available' };
        this.geometryVisible = true;
        geometry.addPointAt(lat, lon);
        this.render();
        return { ok: true };
    }

    const isObserved = kind === 'observed';
    const manager = isObserved ? this.initObservedPosition() : this.initDeadReckoning();
    if (!manager) return { ok: false, error: 'that tool is not available' };

    // A typed point outside the fitted chart would be dropped off the edge of
    // the image, so say so instead of silently marking nothing.
    if (!manager.addAtGeographic(lat, lon)) {
        return { ok: false, error: 'that position is off the chart' };
    }

    if (isObserved) {
        this.observedPositionVisible = true;
    } else {
        this.drPositionVisible = true;
    }
    this.render();
    return { ok: true };
};

// ——— Geometry Tools ———

EnhancedGraticuleSystem.prototype.initGeometry = function() {
    if (!this.geometryManager && this.mapper) {
        this.geometryManager = new GeometryManagerCanvas(this.mapper);
    }
    // Rays run in chart pixels, so they need the chart's extent to know how far
    // to reach. Refreshed here as well as on load, because a new PDF page can
    // arrive while the geometry tool is already open.
    if (this.geometryManager && this.uploadedImage) {
        this.geometryManager.setExtent(this.uploadedImage.width, this.uploadedImage.height);
    }
    // If markers were placed before the geometry tool was opened, back-fill
    // them as external geometry points so they become connectable.
    if (this.geometryManager && this.observedPositionManager) {
        this.observedPositionManager.setGeometryManager(this.geometryManager);
    }
    if (this.geometryManager && this.drPositionManager) {
        this.drPositionManager.setGeometryManager(this.geometryManager);
    }
    return this.geometryManager;
};

EnhancedGraticuleSystem.prototype.toggleGeometry = function() {
    if (!this.geometryManager) {
        this.initGeometry();
    }
    this.geometryVisible = !this.geometryVisible;
    this.render();
    return this.geometryVisible;
};

EnhancedGraticuleSystem.prototype.showGeometry = function() {
    if (!this.geometryManager) {
        this.initGeometry();
    }
    this.geometryVisible = true;
    this.render();
};

EnhancedGraticuleSystem.prototype.hideGeometry = function() {
    this.geometryVisible = false;
    if (this.geometryManager) {
        this.geometryManager.setMode('none');
    }
    this.render();
};

EnhancedGraticuleSystem.prototype.setGeometryMode = function(mode) {
    if (!this.geometryManager) {
        this.initGeometry();
    }
    if (!this.geometryVisible) {
        this.geometryVisible = true;
    }
    this.geometryManager.setMode(mode);
    this.render();
};

EnhancedGraticuleSystem.prototype.clearAllGeometry = function() {
    if (this.geometryManager) {
        this.geometryManager.store.clearAll();
        this.render();
    }
};

EnhancedGraticuleSystem.prototype.getGeometryStore = function() {
    return this.geometryManager ? this.geometryManager.store : null;
};
