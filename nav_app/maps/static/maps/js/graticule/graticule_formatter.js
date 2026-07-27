/**
 * Nautical Coordinate Formatter
 * Converts decimal degrees to nautical format (DD°MM.mm')
 */

/**
 * Convert decimal degrees to nautical format DD°MM.mm'
 * @param {number} decimal - Decimal degrees
 * @param {boolean} isLatitude - True for latitude, false for longitude
 * @returns {string} Formatted coordinate string
 */
function decimalToNautical(decimal, isLatitude) {
    const abs = Math.abs(decimal);
    const degrees = Math.floor(abs);
    const minutes = (abs - degrees) * 60;
    
    // Determine direction
    let direction;
    if (isLatitude) {
        direction = decimal >= 0 ? 'N' : 'S';
    } else {
        direction = decimal >= 0 ? 'E' : 'W';
    }
    
    // Format degrees with appropriate padding (2 digits for lat, 3 for lon)
    const degreesPadded = degrees.toString().padStart(isLatitude ? 2 : 3, '0');
    
    // Format minutes with 2 decimal places
    const minutesFormatted = minutes.toFixed(2).padStart(5, '0');
    
    return `${degreesPadded}°${minutesFormatted}'${direction}`;
}

/**
 * Convert a typed coordinate to decimal degrees.
 *
 * Accepts decimal ("54.5"), nautical ("54°22.1'N", "54°22'30\"N"), a leading or
 * trailing hemisphere, a leading sign, and whitespace in place of the symbols
 * ("54 22.1 N"). The degree and minute marks may be any of the look-alike
 * characters keyboards produce (º ˚ ° / ′ ’ ' / ″ ” ").
 *
 * Returns NaN rather than throwing: every caller guards with isNaN, and a throw
 * escaped those guards and silently killed the surrounding click handler.
 *
 * @param {string|number} nautical
 * @returns {number} Decimal degrees, or NaN if the input is not a coordinate.
 */
function nauticalToDecimal(nautical) {
    if (typeof nautical === 'number') {
        return Number.isFinite(nautical) ? nautical : NaN;
    }
    if (typeof nautical !== 'string') return NaN;

    let s = nautical
        .replace(/[º˚]/g, '°')          // masculine ordinal, ring above
        .replace(/[′’]/g, "'")          // prime, curly apostrophe
        .replace(/[″”]/g, '"')          // double prime, curly quote
        .trim()
        .toUpperCase();
    if (s === '') return NaN;

    // The hemisphere may lead or trail; take it from either end, but not both.
    let hemisphere = '';
    const leading = s.match(/^([NSEW])\s*/);
    if (leading) {
        hemisphere = leading[1];
        s = s.slice(leading[0].length);
    }
    const trailing = s.match(/\s*([NSEW])$/);
    if (trailing) {
        if (hemisphere) return NaN;               // e.g. "N54°22.1'S"
        hemisphere = trailing[1];
        s = s.slice(0, s.length - trailing[0].length);
    }

    let sign = 1;
    const signed = s.match(/^([+-])\s*/);
    if (signed) {
        if (hemisphere) return NaN;               // don't combine "-" with "S"
        sign = signed[1] === '-' ? -1 : 1;
        s = s.slice(signed[0].length);
    }
    if (hemisphere === 'S' || hemisphere === 'W') sign = -1;

    s = s.trim();
    if (s === '') return NaN;

    // degrees[°] [minutes['] [seconds["]] — symbol- or whitespace-separated.
    const parts = s.match(
        /^(\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*'?\s*(?:(\d+(?:\.\d+)?)\s*"?\s*)?)?$/
    );
    if (!parts) return NaN;

    const degrees = parseFloat(parts[1]);
    const minutes = parts[2] === undefined ? 0 : parseFloat(parts[2]);
    const seconds = parts[3] === undefined ? 0 : parseFloat(parts[3]);

    // "54°75.0'" is a typo, not 55.25°. Guessing would misplace the position.
    if (minutes >= 60 || seconds >= 60) return NaN;
    // Only the least significant field may carry a fraction.
    if (parts[2] !== undefined && !Number.isInteger(degrees)) return NaN;
    if (parts[3] !== undefined && !Number.isInteger(minutes)) return NaN;

    return sign * (degrees + minutes / 60 + seconds / 3600);
}

/**
 * Parse a coordinate typed into a form field, in either decimal or nautical
 * notation. Use this at input boundaries instead of branching on whether the
 * string happens to contain a ° or a ' — that test routed "54 22.1 N" to
 * parseFloat, which silently returned 54 and dropped the minutes.
 *
 * @param {string|number} input
 * @returns {number} Decimal degrees, or NaN if the input is not a coordinate.
 */
function parseCoordinate(input) {
    return nauticalToDecimal(input);
}

/**
 * Format a coordinate pair (lat, lon) to nautical format
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lon - Longitude in decimal degrees
 * @returns {string} Formatted coordinate pair
 */
function formatCoordinatePair(lat, lon) {
    return `${decimalToNautical(lat, true)}, ${decimalToNautical(lon, false)}`;
}

/**
 * Format a position for display, or nothing at all if it is incomplete.
 *
 * Unlike formatCoordinatePair this refuses to describe a half-known position:
 * a missing coordinate yields an empty string rather than a coordinate silently
 * built around NaN. Used for the derived "Position text" of a track point.
 *
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lon - Longitude in decimal degrees.
 * @returns {string} Formatted pair, or '' if either coordinate is not a number.
 */
function formatPositionText(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    return formatCoordinatePair(lat, lon);
}

/**
 * Custom graticule label formatter for Leaflet
 * @param {number} coord - Coordinate value
 * @param {string} type - 'lat' or 'lng'
 * @returns {string} Formatted label
 */
function graticuleFormatter(coord, type) {
    const isLatitude = type === 'lat';
    return decimalToNautical(coord, isLatitude);
}

/**
 * Create a custom graticule with nautical formatting
 * @param {object} options - Graticule options
 * @returns {L.Layer} Leaflet graticule layer
 */
function createNauticalGraticule(options = {}) {
    const defaultOptions = {
        interval: 1,
        showLabel: true,
        style: {
            color: '#333',
            weight: 1,
            opacity: 0.4,
            dashArray: '5, 5'
        },
        labelStyle: {
            color: '#333',
            fontSize: '11px',
            fontWeight: 'bold',
            textShadow: '1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white'
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Create graticule with custom formatter
    const graticule = L.graticule(mergedOptions);
    
    // Override the label formatter
    if (graticule.options.showLabel) {
        graticule.options.formatLabel = function(coord, type) {
            return graticuleFormatter(coord, type);
        };
    }
    
    return graticule;
}

/**
 * Calculate distance between two points in nautical miles (using Haversine formula)
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in nautical miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; // Earth radius in nautical miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
}

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Bearing in degrees (0-360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
}

/**
 * Format bearing with cardinal direction
 * @param {number} bearing - Bearing in degrees
 * @returns {string} Formatted bearing (e.g., "045° NE")
 */
function formatBearing(bearing) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return `${bearing.toFixed(0).padStart(3, '0')}° ${directions[index]}`;
}

// Export for use in other modules (if using module system)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        decimalToNautical,
        nauticalToDecimal,
        parseCoordinate,
        formatCoordinatePair,
        formatPositionText,
        graticuleFormatter,
        createNauticalGraticule,
        calculateDistance,
        calculateBearing,
        formatBearing
    };
}