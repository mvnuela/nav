/**
 * Geometry Data Model — Shared between Canvas and Leaflet implementations
 * Points, Connections (line segments), and Rays (half-lines)
 * No rendering code — purely data and graph logic.
 */

class GeometryPoint {
    constructor(id, lat, lon) {
        this.id = id;
        this.lat = lat;
        this.lon = lon;
        this.selected = false;
    }
}

class GeometryConnection {
    constructor(id, pointAId, pointBId) {
        this.id = id;
        this.pointAId = pointAId;
        this.pointBId = pointBId;
        this.selected = false;
    }
}

class GeometryRay {
    constructor(id, originPointId, throughPointId) {
        this.id = id;
        this.originPointId = originPointId;
        this.throughPointId = throughPointId;
        this.selected = false;
    }
}

class GeometryStore {
    constructor() {
        this.points = [];
        this.connections = [];
        this.rays = [];
        this._nextId = 1;
    }

    _id() {
        return this._nextId++;
    }

    addPoint(lat, lon) {
        const pt = new GeometryPoint(this._id(), lat, lon);
        this.points.push(pt);
        return pt;
    }

    addConnection(pointAId, pointBId) {
        const conn = new GeometryConnection(this._id(), pointAId, pointBId);
        this.connections.push(conn);
        return conn;
    }

    addRay(originPointId, throughPointId) {
        const ray = new GeometryRay(this._id(), originPointId, throughPointId);
        this.rays.push(ray);
        return ray;
    }

    getPoint(id) {
        return this.points.find(p => p.id === id) || null;
    }

    getConnectionsForPoint(pointId) {
        return this.connections.filter(
            c => c.pointAId === pointId || c.pointBId === pointId
        );
    }

    getRaysForPoint(pointId) {
        return this.rays.filter(
            r => r.originPointId === pointId || r.throughPointId === pointId
        );
    }

    /**
     * Delete a point and cascade-remove all associated connections and rays.
     * Returns { removedConnectionIds, removedRayIds } for UI cleanup.
     */
    deletePoint(pointId) {
        const removedConnectionIds = [];
        const removedRayIds = [];

        this.connections = this.connections.filter(c => {
            if (c.pointAId === pointId || c.pointBId === pointId) {
                removedConnectionIds.push(c.id);
                return false;
            }
            return true;
        });

        this.rays = this.rays.filter(r => {
            if (r.originPointId === pointId || r.throughPointId === pointId) {
                removedRayIds.push(r.id);
                return false;
            }
            return true;
        });

        this.points = this.points.filter(p => p.id !== pointId);

        return { removedConnectionIds, removedRayIds };
    }

    deleteConnection(connectionId) {
        this.connections = this.connections.filter(c => c.id !== connectionId);
    }

    deleteRay(rayId) {
        this.rays = this.rays.filter(r => r.id !== rayId);
    }

    clearSelection() {
        this.points.forEach(p => p.selected = false);
        this.connections.forEach(c => c.selected = false);
        this.rays.forEach(r => r.selected = false);
    }

    clearAll() {
        this.points = [];
        this.connections = [];
        this.rays = [];
        this._nextId = 1;
    }
}

if (typeof window !== 'undefined') {
    window.GeometryPoint = GeometryPoint;
    window.GeometryConnection = GeometryConnection;
    window.GeometryRay = GeometryRay;
    window.GeometryStore = GeometryStore;
}
