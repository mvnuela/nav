/**
 * GPX Parser Module
 * Standalone XML parser for GPX (GPS Exchange Format) files
 * 
 * Features:
 * - Parses routes, tracks, and waypoints
 * - Calculates distances using Haversine formula (in nautical miles)
 * - Computes bounding boxes and elevation data
 * - Reusable in any JavaScript application
 */

class GPXParser {
    constructor() {
        this.EARTH_RADIUS_NM = 3440.065; // Earth's radius in nautical miles
    }

    /**
     * Parse GPX XML string and return structured data
     * @param {string} gpxString - GPX XML content
     * @returns {Object} Parsed GPX data
     */
    parse(gpxString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(gpxString, 'text/xml');

        // Check for parsing errors
        const parserError = xmlDoc.getElementsByTagName('parsererror');
        if (parserError.length > 0) {
            throw new Error('Invalid GPX XML format');
        }

        const gpx = xmlDoc.getElementsByTagName('gpx')[0];
        if (!gpx) {
            throw new Error('No GPX root element found');
        }

        return {
            metadata: this._parseMetadata(xmlDoc),
            waypoints: this._parseWaypoints(xmlDoc),
            routes: this._parseRoutes(xmlDoc),
            tracks: this._parseTracks(xmlDoc)
        };
    }

    /**
     * Parse GPX metadata
     * @private
     */
    _parseMetadata(xmlDoc) {
        const metadata = xmlDoc.getElementsByTagName('metadata')[0];
        if (!metadata) return {};

        return {
            name: this._getTextContent(metadata, 'name'),
            description: this._getTextContent(metadata, 'desc'),
            author: this._getAuthor(metadata),
            time: this._getTextContent(metadata, 'time')
        };
    }

    /**
     * Parse author information
     * @private
     */
    _getAuthor(metadata) {
        const author = metadata.getElementsByTagName('author')[0];
        if (!author) return null;

        return {
            name: this._getTextContent(author, 'name'),
            email: this._getTextContent(author, 'email')
        };
    }

    /**
     * Parse waypoints
     * @private
     */
    _parseWaypoints(xmlDoc) {
        const waypoints = [];
        const wpts = xmlDoc.getElementsByTagName('wpt');

        for (let i = 0; i < wpts.length; i++) {
            const wpt = wpts[i];
            waypoints.push(this._parsePoint(wpt));
        }

        return waypoints;
    }

    /**
     * Parse routes
     * @private
     */
    _parseRoutes(xmlDoc) {
        const routes = [];
        const rtes = xmlDoc.getElementsByTagName('rte');

        for (let i = 0; i < rtes.length; i++) {
            const rte = rtes[i];
            const points = [];
            const rtepts = rte.getElementsByTagName('rtept');

            for (let j = 0; j < rtepts.length; j++) {
                points.push(this._parsePoint(rtepts[j]));
            }

            if (points.length > 0) {
                const distance = this._calculateTotalDistance(points);
                const bounds = this._calculateBounds(points);

                routes.push({
                    name: this._getTextContent(rte, 'name') || `Route ${i + 1}`,
                    description: this._getTextContent(rte, 'desc'),
                    points: points,
                    distance: distance,
                    bounds: bounds
                });
            }
        }

        return routes;
    }

    /**
     * Parse tracks
     * @private
     */
    _parseTracks(xmlDoc) {
        const tracks = [];
        const trks = xmlDoc.getElementsByTagName('trk');

        for (let i = 0; i < trks.length; i++) {
            const trk = trks[i];
            const segments = [];
            const trksegs = trk.getElementsByTagName('trkseg');

            let allPoints = [];

            for (let j = 0; j < trksegs.length; j++) {
                const seg = trksegs[j];
                const points = [];
                const trkpts = seg.getElementsByTagName('trkpt');

                for (let k = 0; k < trkpts.length; k++) {
                    const point = this._parsePoint(trkpts[k]);
                    points.push(point);
                    allPoints.push(point);
                }

                if (points.length > 0) {
                    segments.push({
                        points: points,
                        distance: this._calculateTotalDistance(points)
                    });
                }
            }

            if (segments.length > 0) {
                const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
                const bounds = this._calculateBounds(allPoints);
                const elevationData = this._calculateElevationData(allPoints);

                tracks.push({
                    name: this._getTextContent(trk, 'name') || `Track ${i + 1}`,
                    description: this._getTextContent(trk, 'desc'),
                    segments: segments,
                    totalDistance: totalDistance,
                    bounds: bounds,
                    elevationData: elevationData
                });
            }
        }

        return tracks;
    }

    /**
     * Parse a single point (waypoint, route point, or track point)
     * @private
     */
    _parsePoint(element) {
        return {
            lat: parseFloat(element.getAttribute('lat')),
            lon: parseFloat(element.getAttribute('lon')),
            name: this._getTextContent(element, 'name'),
            description: this._getTextContent(element, 'desc'),
            elevation: this._getNumericContent(element, 'ele'),
            time: this._getTextContent(element, 'time')
        };
    }

    /**
     * Get text content of first matching child element
     * @private
     */
    _getTextContent(parent, tagName) {
        const elements = parent.getElementsByTagName(tagName);
        return elements.length > 0 ? elements[0].textContent : null;
    }

    /**
     * Get numeric content of first matching child element
     * @private
     */
    _getNumericContent(parent, tagName) {
        const text = this._getTextContent(parent, tagName);
        return text ? parseFloat(text) : null;
    }

    /**
     * Calculate distance between two points using Haversine formula
     * Returns distance in nautical miles
     * @private
     */
    _calculateDistance(lat1, lon1, lat2, lon2) {
        const toRad = (deg) => deg * Math.PI / 180;

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return this.EARTH_RADIUS_NM * c;
    }

    /**
     * Calculate total distance for array of points
     * @private
     */
    _calculateTotalDistance(points) {
        let totalDistance = 0;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            totalDistance += this._calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
        }

        return totalDistance;
    }

    /**
     * Calculate bounding box for array of points
     * @private
     */
    _calculateBounds(points) {
        if (points.length === 0) return null;

        let north = points[0].lat;
        let south = points[0].lat;
        let east = points[0].lon;
        let west = points[0].lon;

        for (const point of points) {
            if (point.lat > north) north = point.lat;
            if (point.lat < south) south = point.lat;
            if (point.lon > east) east = point.lon;
            if (point.lon < west) west = point.lon;
        }

        return {
            north: north,
            south: south,
            east: east,
            west: west,
            center: {
                lat: (north + south) / 2,
                lon: (east + west) / 2
            }
        };
    }

    /**
     * Calculate elevation statistics
     * @private
     */
    _calculateElevationData(points) {
        const elevations = points
            .map(p => p.elevation)
            .filter(e => e !== null && !isNaN(e));

        if (elevations.length === 0) return null;

        const min = Math.min(...elevations);
        const max = Math.max(...elevations);

        // Calculate elevation gain
        let gain = 0;
        for (let i = 0; i < elevations.length - 1; i++) {
            const diff = elevations[i + 1] - elevations[i];
            if (diff > 0) gain += diff;
        }

        return {
            points: elevations.length,
            min: min,
            max: max,
            gain: gain
        };
    }

    /**
     * Get summary statistics
     */
    getSummary(parsedData) {
        return {
            waypointCount: parsedData.waypoints.length,
            routeCount: parsedData.routes.length,
            trackCount: parsedData.tracks.length,
            totalDistance: this._getTotalDistance(parsedData)
        };
    }

    /**
     * Calculate total distance from all routes and tracks
     * @private
     */
    _getTotalDistance(parsedData) {
        let total = 0;

        for (const route of parsedData.routes) {
            total += route.distance;
        }

        for (const track of parsedData.tracks) {
            total += track.totalDistance;
        }

        return total;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GPXParser;
}