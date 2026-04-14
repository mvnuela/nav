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
        const baseline = Math.min(this.canvas.width, this.canvas.height) * 0.38;
        const triangleSize = Math.max(500, Math.min(baseline, 1000));
        this.triangleManager.createStandardPair(
            this.canvas.width,
            this.canvas.height,
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

// ——— Geometry Tools ———

EnhancedGraticuleSystem.prototype.initGeometry = function() {
    if (!this.geometryManager && this.mapper) {
        this.geometryManager = new GeometryManagerCanvas(this.mapper);
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
