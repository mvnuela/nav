/**
 * Course Plotting Extension for Enhanced Graticule System
 * Adds navigation course plotting with bearing and distance calculations
 */

// Extend the EnhancedGraticuleSystem class
(function() {
    'use strict';

    // Store original init method
    const originalInit = EnhancedGraticuleSystem.prototype.constructor;

    // Add course plotting properties
    EnhancedGraticuleSystem.prototype.initCoursePlotting = function() {
        this.courses = [];
        this.currentCourse = null;
        this.courseIdCounter = 0;
    };

    // Add course point when in course mode
    EnhancedGraticuleSystem.prototype.addCoursePoint = function(x, y) {
        if (!this.mapper) return;
        
        const geo = this.mapper.screenToGeographic(x, y);
        
        if (!this.currentCourse) {
            // Start new course
            this.currentCourse = {
                id: this.courseIdCounter++,
                points: [{lat: geo.lat, lon: geo.lon, x, y}],
                complete: false
            };
        } else {
            // Add point to current course
            this.currentCourse.points.push({lat: geo.lat, lon: geo.lon, x, y});
            
            // Calculate course info
            if (this.currentCourse.points.length >= 2) {
                this.calculateCourseInfo(this.currentCourse);
            }
        }
        
        this.render();
    };

    // Complete the current course
    EnhancedGraticuleSystem.prototype.completeCourse = function() {
        if (this.currentCourse && this.currentCourse.points.length >= 2) {
            this.currentCourse.complete = true;
            this.courses.push(this.currentCourse);
            this.currentCourse = null;
            this.render();
            this.updateCoursesList();
        }
    };

    // Cancel current course
    EnhancedGraticuleSystem.prototype.cancelCourse = function() {
        this.currentCourse = null;
        this.render();
    };

    // Clear all courses
    EnhancedGraticuleSystem.prototype.clearAllCourses = function() {
        this.courses = [];
        this.currentCourse = null;
        this.courseIdCounter = 0;
        this.render();
        this.updateCoursesList();
    };

    // Delete specific course
    EnhancedGraticuleSystem.prototype.deleteCourse = function(id) {
        this.courses = this.courses.filter(c => c.id !== id);
        this.render();
        this.updateCoursesList();
    };

    // Calculate bearing and distance for each leg
    EnhancedGraticuleSystem.prototype.calculateCourseInfo = function(course) {
        const points = course.points;
        let totalDistance = 0;
        const legs = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            
            const distance = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
            const bearing = calculateBearing(p1.lat, p1.lon, p2.lat, p2.lon);
            
            totalDistance += distance;
            legs.push({distance, bearing});
        }
        
        course.totalDistance = totalDistance;
        course.legs = legs;
    };

    // Draw all courses
    EnhancedGraticuleSystem.prototype.drawCourses = function() {
        if (!this.courses && !this.currentCourse) return;
        
        // Draw completed courses
        if (this.courses) {
            this.courses.forEach(course => {
                this.drawCourse(course, '#2196F3', false);
            });
        }
        
        // Draw current course being plotted
        if (this.currentCourse) {
            this.drawCourse(this.currentCourse, '#FF5722', true);
        }
    };

    // Draw a single course
    EnhancedGraticuleSystem.prototype.drawCourse = function(course, color, isCurrent) {
        const points = course.points;
        if (!points || points.length === 0) return;
        
        this.ctx.save();
        
        // Draw lines between waypoints
        if (points.length > 1) {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = isCurrent ? 3 : 2;
            this.ctx.setLineDash([]);
            this.ctx.globalAlpha = isCurrent ? 0.9 : 0.7;
            
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                this.ctx.lineTo(points[i].x, points[i].y);
            }
            this.ctx.stroke();
            
            // Draw leg info (bearing and distance)
            if (course.legs) {
                for (let i = 0; i < course.legs.length; i++) {
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    const leg = course.legs[i];
                    
                    // Calculate midpoint
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    
                    const labelText = `${leg.bearing.toFixed(0)}° / ${leg.distance.toFixed(1)} nm`;
                    
                    this.ctx.font = 'bold 11px sans-serif';
                    const labelWidth = this.ctx.measureText(labelText).width + 8;
                    
                    // Label background
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    this.ctx.fillRect(midX - labelWidth/2, midY - 10, labelWidth, 20);
                    
                    // Label border
                    this.ctx.strokeStyle = color;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(midX - labelWidth/2, midY - 10, labelWidth, 20);
                    
                    // Label text
                    this.ctx.fillStyle = color;
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(labelText, midX, midY);
                }
            }
        }
        
        // Draw waypoints
        points.forEach((point, i) => {
            this.ctx.fillStyle = color;
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, isCurrent ? 7 : 6, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw waypoint number
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText((i + 1).toString(), point.x, point.y);
        });
        
        this.ctx.restore();
    };

    // Update courses list in UI
    EnhancedGraticuleSystem.prototype.updateCoursesList = function() {
        const listEl = document.getElementById('coursesList');
        if (!listEl) return;
        
        if (!this.courses || this.courses.length === 0) {
            listEl.innerHTML = '<div style="color:#999; padding:10px; text-align:center; font-size:0.9em;">No courses plotted yet</div>';
            return;
        }
        
        listEl.innerHTML = this.courses.map(course => `
            <div style="background:white; border:1px solid #ddd; border-radius:4px; padding:10px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong style="color:#2196F3;">Course ${course.id + 1}</strong>
                    <button onclick="window.graticuleSystem.deleteCourse(${course.id})" 
                            style="background:#ff5722; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:0.85em;">
                        Delete
                    </button>
                </div>
                <div style="font-size:0.9em; color:#666;">
                    ${course.points.length} waypoints<br>
                    Total: <strong>${course.totalDistance.toFixed(1)} nm</strong>
                </div>
                ${course.legs ? course.legs.map((leg, i) => `
                    <div style="font-size:0.85em; color:#888; margin-top:3px;">
                        Leg ${i + 1}: ${leg.bearing.toFixed(0)}° / ${leg.distance.toFixed(1)} nm
                    </div>
                `).join('') : ''}
            </div>
        `).join('');
    };

    // Override render to include courses
    const originalRender = EnhancedGraticuleSystem.prototype.render;
    EnhancedGraticuleSystem.prototype.render = function() {
        originalRender.call(this);
        
        // Draw courses on top
        if (this.mapper && (this.courses || this.currentCourse)) {
            this.drawCourses();
        }
    };

    // Override handleMouseDown to support course mode
    const originalHandleMouseDown = EnhancedGraticuleSystem.prototype.handleMouseDown;
    EnhancedGraticuleSystem.prototype.handleMouseDown = function(e) {
        if (this.mode === 'course' && this.mapper) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            this.addCoursePoint(x, y);
            return;
        }
        
        originalHandleMouseDown.call(this, e);
    };

    // Override handleMouseMove to support course mode
    const originalHandleMouseMove = EnhancedGraticuleSystem.prototype.handleMouseMove;
    EnhancedGraticuleSystem.prototype.handleMouseMove = function(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        if (this.mode === 'course' && this.mapper) {
            // Show coordinates in course mode
            this.showCoordinates(x, y);
            this.canvas.style.cursor = 'crosshair';
            return;
        }
        
        originalHandleMouseMove.call(this, e);
    };

    console.log('Course plotting extension loaded');
})();