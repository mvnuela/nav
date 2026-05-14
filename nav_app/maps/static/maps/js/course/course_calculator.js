/**
 * Nautical Course Calculator
 * Computes compass course from Course Over Ground (COG) considering:
 * - Drift/Leeway (wind and current effects)
 * - Magnetic Declination (variation)
 * - Compass Deviation
 * 
 * Navigation formula: COG → True Course → Magnetic Course → Compass Course
 * Memory aid: "Can Dead Men Vote Twice" (Compass, Deviation, Magnetic, Variation, True)
 */

class CourseCalculator {
    constructor() {
        // Input values
        this.courseOverGround = null;  // COG in degrees (0-360)
        this.drift = null;              // Leeway in degrees (+starboard, -port)
        this.declination = null;        // Variation in degrees (+E, -W)
        this.deviation = null;          // Compass deviation in degrees
        
        // Calculated values
        this.trueCourse = null;
        this.magneticCourse = null;
        this.compassCourse = null;
        
        // Calculation steps for display
        this.steps = [];
    }
    
    /**
     * Normalize angle to 0-360° range
     */
    normalize(angle) {
        angle = angle % 360;
        if (angle < 0) {
            angle += 360;
        }
        return angle;
    }
    
    /**
     * Format angle with cardinal direction helper
     */
    formatCourse(degrees) {
        const normalized = this.normalize(degrees);
        let cardinal = '';
        
        // Determine cardinal direction
        if (normalized >= 337.5 || normalized < 22.5) cardinal = 'N';
        else if (normalized >= 22.5 && normalized < 67.5) cardinal = 'NE';
        else if (normalized >= 67.5 && normalized < 112.5) cardinal = 'E';
        else if (normalized >= 112.5 && normalized < 157.5) cardinal = 'SE';
        else if (normalized >= 157.5 && normalized < 202.5) cardinal = 'S';
        else if (normalized >= 202.5 && normalized < 247.5) cardinal = 'SW';
        else if (normalized >= 247.5 && normalized < 292.5) cardinal = 'W';
        else if (normalized >= 292.5 && normalized < 337.5) cardinal = 'NW';
        
        return {
            degrees: normalized,
            formatted: `${normalized.toFixed(1)}°`,
            cardinal: cardinal,
            display: `${normalized.toFixed(1)}° (${cardinal})`
        };
    }
    
    /**
     * Calculate all courses from COG
     * Returns calculation results and detailed steps
     */
    calculate(cog, drift, declination, deviation) {
        this.courseOverGround = parseFloat(cog);
        this.drift = parseFloat(drift);
        this.declination = parseFloat(declination);
        this.deviation = parseFloat(deviation);
        
        // Validate inputs
        if (isNaN(this.courseOverGround) || isNaN(this.drift) || 
            isNaN(this.declination) || isNaN(this.deviation)) {
            throw new Error('All input values must be valid numbers');
        }
        
        this.steps = [];
        
        // Step 1: Calculate True Course
        // True Course = COG - Drift
        // (Positive drift = vessel being pushed to starboard, so we subtract to get intended course)
        const rawTrue = this.courseOverGround - this.drift;
        this.trueCourse = this.normalize(rawTrue);
        
        this.steps.push({
            name: 'True Course (T)',
            formula: 'T = COG − Drift',
            calculation: `${this.courseOverGround.toFixed(1)}° − ${this.drift.toFixed(1)}° = ${rawTrue.toFixed(1)}°`,
            normalized: rawTrue !== this.trueCourse ? `Normalized: ${this.trueCourse.toFixed(1)}°` : null,
            result: this.trueCourse,
            description: 'Course relative to true north, corrected for drift/leeway'
        });
        
        // Step 2: Calculate Magnetic Course
        // Magnetic Course = True Course - Declination
        // (East declination is positive, so magnetic north is east of true north)
        const rawMagnetic = this.trueCourse - this.declination;
        this.magneticCourse = this.normalize(rawMagnetic);
        
        this.steps.push({
            name: 'Magnetic Course (M)',
            formula: 'M = T − Declination',
            calculation: `${this.trueCourse.toFixed(1)}° − ${this.declination.toFixed(1)}° = ${rawMagnetic.toFixed(1)}°`,
            normalized: rawMagnetic !== this.magneticCourse ? `Normalized: ${this.magneticCourse.toFixed(1)}°` : null,
            result: this.magneticCourse,
            description: 'Course relative to magnetic north'
        });
        
        // Step 3: Calculate Compass Course
        // Compass Course = Magnetic Course - Deviation
        const rawCompass = this.magneticCourse - this.deviation;
        this.compassCourse = this.normalize(rawCompass);
        
        this.steps.push({
            name: 'Compass Course (C)',
            formula: 'C = M − Deviation',
            calculation: `${this.magneticCourse.toFixed(1)}° − ${this.deviation.toFixed(1)}° = ${rawCompass.toFixed(1)}°`,
            normalized: rawCompass !== this.compassCourse ? `Normalized: ${this.compassCourse.toFixed(1)}°` : null,
            result: this.compassCourse,
            description: 'Course to steer by magnetic compass'
        });
        
        return {
            input: {
                cog: this.formatCourse(this.courseOverGround),
                drift: this.drift,
                declination: this.declination,
                deviation: this.deviation
            },
            output: {
                trueCourse: this.formatCourse(this.trueCourse),
                magneticCourse: this.formatCourse(this.magneticCourse),
                compassCourse: this.formatCourse(this.compassCourse)
            },
            steps: this.steps,
            summary: this.generateSummary()
        };
    }
    
    /**
     * Calculate reverse: from Compass Course to True Course
     */
    calculateReverse(compassCourse, deviation, declination, drift) {
        this.compassCourse = parseFloat(compassCourse);
        this.deviation = parseFloat(deviation);
        this.declination = parseFloat(declination);
        this.drift = parseFloat(drift);
        
        // Validate inputs
        if (isNaN(this.compassCourse) || isNaN(this.deviation) || 
            isNaN(this.declination) || isNaN(this.drift)) {
            throw new Error('All input values must be valid numbers');
        }
        
        this.steps = [];
        
        // Step 1: Calculate Magnetic Course
        // Magnetic Course = Compass Course + Deviation
        const rawMagnetic = this.compassCourse + this.deviation;
        this.magneticCourse = this.normalize(rawMagnetic);
        
        this.steps.push({
            name: 'Magnetic Course (M)',
            formula: 'M = C + Deviation',
            calculation: `${this.compassCourse.toFixed(1)}° + ${this.deviation.toFixed(1)}° = ${rawMagnetic.toFixed(1)}°`,
            normalized: rawMagnetic !== this.magneticCourse ? `Normalized: ${this.magneticCourse.toFixed(1)}°` : null,
            result: this.magneticCourse,
            description: 'Course relative to magnetic north'
        });
        
        // Step 2: Calculate True Course
        // True Course = Magnetic Course + Declination
        const rawTrue = this.magneticCourse + this.declination;
        this.trueCourse = this.normalize(rawTrue);
        
        this.steps.push({
            name: 'True Course (T)',
            formula: 'T = M + Declination',
            calculation: `${this.magneticCourse.toFixed(1)}° + ${this.declination.toFixed(1)}° = ${rawTrue.toFixed(1)}°`,
            normalized: rawTrue !== this.trueCourse ? `Normalized: ${this.trueCourse.toFixed(1)}°` : null,
            result: this.trueCourse,
            description: 'Course relative to true north'
        });
        
        // Step 3: Calculate COG
        // COG = True Course + Drift
        const rawCOG = this.trueCourse + this.drift;
        this.courseOverGround = this.normalize(rawCOG);
        
        this.steps.push({
            name: 'Course Over Ground (COG)',
            formula: 'COG = T + Drift',
            calculation: `${this.trueCourse.toFixed(1)}° + ${this.drift.toFixed(1)}° = ${rawCOG.toFixed(1)}°`,
            normalized: rawCOG !== this.courseOverGround ? `Normalized: ${this.courseOverGround.toFixed(1)}°` : null,
            result: this.courseOverGround,
            description: 'Actual track over ground'
        });
        
        return {
            input: {
                compassCourse: this.formatCourse(this.compassCourse),
                deviation: this.deviation,
                declination: this.declination,
                drift: this.drift
            },
            output: {
                magneticCourse: this.formatCourse(this.magneticCourse),
                trueCourse: this.formatCourse(this.trueCourse),
                cog: this.formatCourse(this.courseOverGround)
            },
            steps: this.steps,
            summary: this.generateReverseSummary()
        };
    }
    
    /**
     * Generate human-readable summary
     */
    generateSummary() {
        const driftDesc = this.drift > 0 ? `${this.drift}° to starboard` : 
                         this.drift < 0 ? `${Math.abs(this.drift)}° to port` : 
                         'no drift';
        
        const declDesc = this.declination > 0 ? `${this.declination}° E` : 
                        this.declination < 0 ? `${Math.abs(this.declination)}° W` : 
                        'no variation';
        
        const devDesc = this.deviation > 0 ? `${this.deviation}° E` : 
                       this.deviation < 0 ? `${Math.abs(this.deviation)}° W` : 
                       'no deviation';
        
        return {
            text: `To maintain a COG of ${this.courseOverGround.toFixed(1)}° with ${driftDesc}, ` +
                  `magnetic declination ${declDesc}, and compass deviation ${devDesc}, ` +
                  `steer compass course ${this.compassCourse.toFixed(1)}°.`,
            simplified: `Steer: ${this.compassCourse.toFixed(1)}° (Compass) for COG: ${this.courseOverGround.toFixed(1)}° (True)`
        };
    }
    
    /**
     * Generate reverse calculation summary
     */
    generateReverseSummary() {
        return {
            text: `Steering compass course ${this.compassCourse.toFixed(1)}° will result in ` +
                  `a Course Over Ground of ${this.courseOverGround.toFixed(1)}°.`,
            simplified: `Compass: ${this.compassCourse.toFixed(1)}° → COG: ${this.courseOverGround.toFixed(1)}°`
        };
    }
    
    /**
     * Get memory aid for the conversion
     */
    static getMemoryAid() {
        return {
            forward: {
                mnemonic: "True Virgins Make Dull Company",
                order: ["True", "Variation (subtract)", "Magnetic", "Deviation (subtract)", "Compass"],
                rule: "Subtract East variation and deviation when going from True to Compass"
            },
            reverse: {
                mnemonic: "Can Dead Men Vote Twice",
                order: ["Compass", "Deviation (add)", "Magnetic", "Variation (add)", "True"],
                rule: "Add East variation and deviation when going from Compass to True"
            }
        };
    }
    
    /**
     * Validate input ranges
     */
    static validateInputs(cog, drift, declination, deviation) {
        const errors = [];
        
        if (cog < 0 || cog >= 360) {
            errors.push('COG must be between 0 and 360 degrees');
        }
        
        if (Math.abs(drift) > 90) {
            errors.push('Drift should typically be less than 90 degrees');
        }
        
        if (Math.abs(declination) > 180) {
            errors.push('Declination must be between -180 and 180 degrees');
        }
        
        if (Math.abs(deviation) > 180) {
            errors.push('Deviation must be between -180 and 180 degrees');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Calculate dead reckoning position
     * @param {number} startLat - Starting latitude
     * @param {number} startLon - Starting longitude
     * @param {number} cog - Course Over Ground (from calculate method)
     * @param {number} speed - Speed in knots
     * @param {number} time - Time in hours
     * @returns {object} DR position and track info
     */
    calculateDRPosition(startLat, startLon, cog, speed, time) {
        // Calculate distance traveled
        const distance = speed * time; // nautical miles
        
        // Convert COG to radians
        const cogRad = cog * Math.PI / 180;
        
        // Calculate change in latitude and longitude
        // dLat in degrees = (distance in NM) / 60
        const dLat = distance * Math.cos(cogRad) / 60;
        
        // dLon in degrees = (distance in NM) / (60 * cos(latitude))
        const dLon = distance * Math.sin(cogRad) / (60 * Math.cos(startLat * Math.PI / 180));
        
        // Calculate new position
        const drLat = startLat + dLat;
        const drLon = startLon + dLon;
        
        return {
            startPosition: {
                lat: startLat,
                lon: startLon
            },
            drPosition: {
                lat: drLat,
                lon: drLon
            },
            distance: distance,
            cog: cog,
            speed: speed,
            time: time
        };
    }
}

// Make available globally
window.CourseCalculator = CourseCalculator;