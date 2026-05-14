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
 * Convert nautical format to decimal degrees
 * @param {string} nautical - Nautical format string (e.g., "54°30.25'N" or "54°30'N")
 * @returns {number} Decimal degrees
 */
function nauticalToDecimal(nautical) {
    // Trim whitespace
    nautical = nautical.trim();
    
    // Try multiple regex patterns
    // Pattern 1: DD°MM.mm'H (with decimal minutes)
    let regex = /(\d+)°(\d+\.?\d*)'?([NSEW])/i;
    let match = nautical.match(regex);
    
    // Pattern 2: DD°MM'MM"H (degrees, minutes, seconds)
    if (!match) {
        regex = /(\d+)°(\d+)'(\d+)"?([NSEW])/i;
        match = nautical.match(regex);
        if (match) {
            const degrees = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const seconds = parseInt(match[3]);
            const direction = match[4].toUpperCase();
            
            let decimal = degrees + minutes / 60 + seconds / 3600;
            
            if (direction === 'S' || direction === 'W') {
                decimal = -decimal;
            }
            
            return decimal;
        }
    }
    
    // Pattern 3: Just degrees with direction
    if (!match) {
        regex = /(\d+\.?\d*)°?([NSEW])/i;
        match = nautical.match(regex);
        if (match) {
            let decimal = parseFloat(match[1]);
            const direction = match[2].toUpperCase();
            
            if (direction === 'S' || direction === 'W') {
                decimal = -decimal;
            }
            
            return decimal;
        }
    }
    
    if (!match) {
        throw new Error('Invalid nautical format: ' + nautical);
    }
    
    const degrees = parseInt(match[1]);
    const minutes = parseFloat(match[2]) || 0;
    const direction = match[3].toUpperCase();
    
    // Convert to decimal
    let decimal = degrees + (minutes / 60);
    
    // Apply sign based on direction
    if (direction === 'S' || direction === 'W') {
        decimal = -decimal;
    }
    
    return decimal;
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
        formatCoordinatePair,
        graticuleFormatter,
        createNauticalGraticule,
        calculateDistance,
        calculateBearing,
        formatBearing
    };
}