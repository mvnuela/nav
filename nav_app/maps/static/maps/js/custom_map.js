/**
 * Custom Map Graticule Overlay with PDF Support and Point Plotting
 * Allows users to upload a PDF or image map, define coordinate bounds,
 * overlay a graticule with minute intervals, and plot coordinate points
 */

(function() {
    'use strict';

    // State
    let uploadedImage = null;
    let canvas = null;
    let ctx = null;
    let minLat = null;
    let maxLat = null;
    let minLon = null;
    let maxLon = null;
    let gridIntervalMinutes = 30;
    let showMinuteLines = false;
    let graticuleGenerated = false;
    let plottedPoints = [];
    let pointIdCounter = 0;
    

    /**
     * Initialize the application
     */
    function init() {
        canvas = document.getElementById('mapCanvas');
        ctx = canvas.getContext('2d');

        // Setup event listeners
        document.getElementById('mapUpload').addEventListener('change', handleFileUpload);
        document.getElementById('generateBtn').addEventListener('click', generateGraticule);
        document.getElementById('clearBtn').addEventListener('click', clearAll);
        document.getElementById('gridInterval').addEventListener('change', updateGridInterval);
        document.getElementById('showMinuteLines').addEventListener('change', updateShowMinuteLines);
        document.getElementById('addPointBtn').addEventListener('click', addPointFromInput);
        document.getElementById('clearPointsBtn').addEventListener('click', clearAllPoints);

        // Canvas interaction
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('mousemove', handleCanvasMouseMove);

        // Update on coordinate input
        ['minLat', 'maxLat', 'minLon', 'maxLon'].forEach(id => {
            document.getElementById(id).addEventListener('input', checkGenerateReady);
            document.getElementById(id).addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    generateGraticule();
                }
            });
        });

        // Point input enter key
        ['pointLat', 'pointLon'].forEach(id => {
            document.getElementById(id).addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    addPointFromInput();
                }
            });
        });

        console.log('Custom Map Graticule initialized');
    }

    /**
     * Handle file upload (PDF or image)
     */
    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const isPDF = file.type === 'application/pdf';
        const isImage = file.type.match('image/(png|jpeg|jpg)');

        if (!isPDF && !isImage) {
            alert('Please upload a PDF or image file (PNG, JPG, JPEG)');
            return;
        }

        if (isPDF) {
            await handlePDFUpload(file);
        } else {
            handleImageUpload(file);
        }
    }

    /**
     * Handle PDF upload and conversion
     */
    async function handlePDFUpload(file) {
        try {
            const formData = new FormData();
            formData.append('pdf', file);

            const response = await fetch('/api/convert-pdf/', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                const img = new Image();
                img.onload = function() {
                    uploadedImage = img;
                    setupCanvas(img);
                    document.getElementById('imageDimensions').textContent =
                        `${img.width} × ${img.height} pixels (converted from PDF)`;
                    document.getElementById('imageInfo').style.display = 'block';
                    document.getElementById('placeholder').style.display = 'none';
                    canvas.classList.add('active');
                    checkGenerateReady();
                };
                img.src = data.image;
            } else {
                alert('Error converting PDF: ' + data.error);
            }
        } catch (error) {
            console.error('PDF conversion error:', error);
            alert('Failed to convert PDF. Please try again.');
        }
    }

    /**
     * Handle image upload
     */
    function handleImageUpload(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                uploadedImage = img;
                setupCanvas(img);
                document.getElementById('imageDimensions').textContent =
                    `${img.width} × ${img.height} pixels`;
                document.getElementById('imageInfo').style.display = 'block';
                document.getElementById('placeholder').style.display = 'none';
                canvas.classList.add('active');
                checkGenerateReady();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Setup canvas with uploaded image
     */
    function setupCanvas(img) {
        canvas.width = img.width;
        canvas.height = img.height;
        drawImage();
        // Don't fit to window yet - wait for graticule generation
    }

    /**
     * Fit canvas to window using CSS scaling
     */
    function fitToWindow() {
        if (!uploadedImage) return;
        
        const container = document.getElementById('mapContainer');
        const containerWidth = container.clientWidth - 40; // padding
        const containerHeight = container.clientHeight - 40; // padding
        
        const imageWidth = uploadedImage.width;
        const imageHeight = uploadedImage.height;
        
        // Calculate scale to fit
        const scaleX = containerWidth / imageWidth;
        const scaleY = containerHeight / imageHeight;
        const scale = Math.min(scaleX, scaleY, 1.0); // Don't zoom in beyond 100%
        
        // Apply CSS scaling
        const newWidth = imageWidth * scale;
        const newHeight = imageHeight * scale;
        
        canvas.style.width = newWidth + 'px';
        canvas.style.height = newHeight + 'px';
    }

    /**
     * Draw the uploaded image on canvas
     */
    function drawImage() {
        if (!uploadedImage) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(uploadedImage, 0, 0);
    }

    /**
     * Parse coordinate bounds from inputs
     */
    function parseCoordinateBounds() {
        const minLatInput = document.getElementById('minLat').value.trim();
        const maxLatInput = document.getElementById('maxLat').value.trim();
        const minLonInput = document.getElementById('minLon').value.trim();
        const maxLonInput = document.getElementById('maxLon').value.trim();

        if (!minLatInput || !maxLatInput || !minLonInput || !maxLonInput) return false;

        try {
            minLat = parseCoordinate(minLatInput);
            maxLat = parseCoordinate(maxLatInput);
            minLon = parseCoordinate(minLonInput);
            maxLon = parseCoordinate(maxLonInput);

            if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) return false;
            if (minLat >= maxLat || minLon >= maxLon) return false;
            if (minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180) return false;

            return true;
        } catch (error) {
            console.error('Coordinate parsing error:', error);
            return false;
        }
    }

    /**
     * Parse coordinate (supports DMS and decimal formats)
     */
    function parseCoordinate(input) {
        if (input.includes('°') || input.includes('\'')) {
            return nauticalToDecimal(input);
        }
        return parseFloat(input);
    }

    /**
     * Check if ready to generate graticule
     */
    function checkGenerateReady() {
        const ready = uploadedImage && parseCoordinateBounds();
        document.getElementById('generateBtn').disabled = !ready;
    }

    /**
     * Update grid interval from select
     */
    function updateGridInterval(event) {
        gridIntervalMinutes = parseInt(event.target.value);
        if (graticuleGenerated) {
            redrawAll();
        }
    }

    /**
     * Update show minute lines checkbox
     */
    function updateShowMinuteLines(event) {
        showMinuteLines = event.target.checked;
        if (graticuleGenerated) {
            redrawAll();
        }
    }


    /**
     * Generate and draw graticule
     */
    function generateGraticule() {
        if (!parseCoordinateBounds()) {
            alert('Please enter valid coordinate bounds');
            return;
        }

        if (!uploadedImage) {
            alert('Please upload a map file first');
            return;
        }

        graticuleGenerated = true;
        redrawAll();
        
        // Fit image to window after graticule is generated
        fitToWindow();
        
        // Show coordinate display
        document.getElementById('coordinateDisplay').style.display = 'block';

        console.log('Graticule generated', {
            bounds: {minLat, maxLat, minLon, maxLon},
            intervalMinutes: gridIntervalMinutes
        });
    }

     /**
     * Redraw complete map with graticule and points
     */
    function redrawAll() {
        if (!uploadedImage || !graticuleGenerated) return;
        
        drawImage();
        drawGraticuleGrid();
        redrawAllPoints();
    }

    /**
     * Draw graticule grid on canvas
     */
    function drawGraticuleGrid() {
        const intervalDegrees = gridIntervalMinutes / 60;

        // Round to nearest interval
        const startLat = Math.floor(minLat / intervalDegrees) * intervalDegrees;
        const endLat = Math.ceil(maxLat / intervalDegrees) * intervalDegrees;
        const startLon = Math.floor(minLon / intervalDegrees) * intervalDegrees;
        const endLon = Math.ceil(maxLon / intervalDegrees) * intervalDegrees;

        ctx.save();
        ctx.strokeStyle = '#0078A8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.7;

        // Draw latitude lines
        for (let lat = startLat; lat <= endLat; lat += intervalDegrees) {
            if (lat < minLat || lat > maxLat) continue;
            
            // Check if this is an edge line (boundary)
            const isEdgeLine = (Math.abs(lat - minLat) < 0.0001) || (Math.abs(lat - maxLat) < 0.0001);
            
            // Check if this is a whole degree line
            const isWholeDegree = Math.abs(lat - Math.round(lat)) < 0.0001;
            
            const y = latToPixel(lat);
            
            if (y >= 0 && y <= canvas.height) {
                // Determine if we should draw this line
                const shouldDrawLine = isEdgeLine || isWholeDegree || showMinuteLines;
                
                if (shouldDrawLine) {
                    // Draw edge lines thicker and solid
                    if (isEdgeLine) {
                        ctx.save();
                        ctx.lineWidth = 2;
                        ctx.setLineDash([]);
                        ctx.globalAlpha = 0.9;
                    }
                    // Draw whole degree lines slightly thicker
                    else if (isWholeDegree) {
                        ctx.save();
                        ctx.lineWidth = 2;
                        ctx.globalAlpha = 0.8;
                    }
                    
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(canvas.width, y);
                    ctx.stroke();
                    
                    if (isEdgeLine || isWholeDegree) {
                        ctx.restore();
                    }
                }
                
                // Draw labels
                drawLatitudeLabel(lat, 10, y, isWholeDegree);
            }
        }

        // Draw longitude lines
        for (let lon = startLon; lon <= endLon; lon += intervalDegrees) {
            if (lon < minLon || lon > maxLon) continue;
            
            // Check if this is an edge line (boundary)
            const isEdgeLine = (Math.abs(lon - minLon) < 0.0001) || (Math.abs(lon - maxLon) < 0.0001);
            
            // Check if this is a whole degree line
            const isWholeDegree = Math.abs(lon - Math.round(lon)) < 0.0001;
            
            const x = lonToPixel(lon);
            
            if (x >= 0 && x <= canvas.width) {
                // Determine if we should draw this line
                const shouldDrawLine = isEdgeLine || isWholeDegree || showMinuteLines;
                
                if (shouldDrawLine) {
                    // Draw edge lines thicker and solid
                    if (isEdgeLine) {
                        ctx.save();
                        ctx.lineWidth = 2;
                        ctx.setLineDash([]);
                        ctx.globalAlpha = 0.9;
                    }
                    // Draw whole degree lines slightly thicker
                    else if (isWholeDegree) {
                        ctx.save();
                        ctx.lineWidth = 2;
                        ctx.globalAlpha = 0.8;
                    }
                    
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, canvas.height);
                    ctx.stroke();
                    
                    if (isEdgeLine || isWholeDegree) {
                        ctx.restore();
                    }
                }
                
                // Draw labels
                drawLongitudeLabel(lon, x, 20, isWholeDegree);
            }
        }

        ctx.restore();
    }

    /**
     * Convert latitude/longitude to pixel coordinates
     */
    function latLonToPixel(lat, lon) {
        const latRange = maxLat - minLat;
        const lonRange = maxLon - minLon;
        const pixelHeight = canvas.height;
        const pixelWidth = canvas.width;
        
        const x = pixelWidth * (lon - minLon) / lonRange;
        const y = pixelHeight * (1 - (lat - minLat) / latRange);
        
        return { x, y };
    }

    /**
     * Convert latitude to pixel Y coordinate
     */
    function latToPixel(lat) {
        const latRange = maxLat - minLat;
        const pixelHeight = canvas.height;
        
        // Invert Y axis (top = max lat, bottom = min lat)
        return pixelHeight * (1 - (lat - minLat) / latRange);
    }

    /**
     * Convert longitude to pixel X coordinate
     */
    function lonToPixel(lon) {
        const lonRange = maxLon - minLon;
        const pixelWidth = canvas.width;
        
        return pixelWidth * (lon - minLon) / lonRange;
    }

    /**
     * Convert pixel coordinates to lat/lon
     */
    function pixelToLatLon(x, y) {
        return {
            lat: pixelToLat(y),
            lon: pixelToLon(x)
        };
    }

    /**
     * Convert pixel X coordinate to longitude
     */
    function pixelToLon(x) {
        const lonRange = maxLon - minLon;
        return minLon + (x / canvas.width) * lonRange;
    }

    /**
     * Convert pixel Y coordinate to latitude
     */
    function pixelToLat(y) {
        const latRange = maxLat - minLat;
        // Invert Y axis
        return maxLat - (y / canvas.height) * latRange;
    }

    /**
     * Draw latitude label (nautical map style)
     */
    function drawLatitudeLabel(lat, x, y, isWholeDegree) {
        let label;
        
        if (isWholeDegree) {
            // Full label for whole degrees: "69°N"
            const degrees = Math.round(Math.abs(lat));
            const direction = lat >= 0 ? 'N' : 'S';
            label = `${degrees}°${direction}`;
        } else {
            // Minutes only for fractional degrees: "30'"
            const abs = Math.abs(lat);
            const degrees = Math.floor(abs);
            const minutes = Math.round((abs - degrees) * 60);
            label = `${minutes}'`;
        }
        
        ctx.save();
        const labelWidth = ctx.measureText(label).width + 8;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(x - 2, y - 12, labelWidth, 24);
        
        ctx.strokeStyle = '#0078A8';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 2, y - 12, labelWidth, 24);
        
        ctx.fillStyle = '#0078A8';
        ctx.font = isWholeDegree ? 'bold 13px monospace' : 'normal 11px monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 2, y);
        ctx.restore();
    }

    /**
     * Draw longitude label (nautical map style)
     */
    function drawLongitudeLabel(lon, x, y, isWholeDegree) {
        let label;
        
        if (isWholeDegree) {
            // Full label for whole degrees: "018°E"
            const degrees = Math.round(Math.abs(lon));
            const direction = lon >= 0 ? 'E' : 'W';
            label = `${degrees.toString().padStart(3, '0')}°${direction}`;
        } else {
            // Minutes only for fractional degrees: "30'"
            const abs = Math.abs(lon);
            const degrees = Math.floor(abs);
            const minutes = Math.round((abs - degrees) * 60);
            label = `${minutes}'`;
        }
        
        ctx.save();
        const width = ctx.measureText(label).width + 10;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(x - width/2, y - 2, width, 24);
        
        ctx.strokeStyle = '#0078A8';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - width/2, y - 2, width, 24);
        
        ctx.fillStyle = '#0078A8';
        ctx.font = isWholeDegree ? 'bold 13px monospace' : 'normal 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x, y + 2);
        ctx.restore();
    }

    /**
     * Handle canvas click for point plotting
     */
    function handleCanvasClick(event) {
        const rect = canvas.getBoundingClientRect();
        // Account for CSS scaling: convert from displayed pixels to canvas pixels
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Handle point plotting (only after graticule is generated)
        if (!graticuleGenerated) return;

        const coords = pixelToLatLon(x, y);
        addPoint(coords.lat, coords.lon, `Point ${pointIdCounter + 1}`);
    }

    /**
     * Handle canvas mouse move to show coordinates
     */
    function handleCanvasMouseMove(event) {
        if (!graticuleGenerated) return;

        const rect = canvas.getBoundingClientRect();
        // Account for CSS scaling: convert from displayed pixels to canvas pixels
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        const lat = pixelToLat(y);
        const lon = pixelToLon(x);

        const latStr = decimalToNautical(lat, true);
        const lonStr = decimalToNautical(lon, false);

        document.getElementById('cursorCoords').innerHTML =
            `<strong>Lat:</strong> ${latStr}<br><strong>Lon:</strong> ${lonStr}`;
    }

    /**
     * Add point from input fields
     */
    function addPointFromInput() {
        const latInput = document.getElementById('pointLat').value.trim();
        const lonInput = document.getElementById('pointLon').value.trim();
        const labelInput = document.getElementById('pointLabel').value.trim();

        if (!latInput || !lonInput) {
            alert('Please enter both latitude and longitude');
            return;
        }

        try {
            const lat = parseCoordinate(latInput);
            const lon = parseCoordinate(lonInput);

            if (isNaN(lat) || isNaN(lon)) {
                alert('Invalid coordinates');
                return;
            }

            const label = labelInput || `Point ${pointIdCounter + 1}`;
            addPoint(lat, lon, label);

            // Clear inputs
            document.getElementById('pointLat').value = '';
            document.getElementById('pointLon').value = '';
            document.getElementById('pointLabel').value = '';
        } catch (error) {
            alert('Error parsing coordinates: ' + error.message);
        }
    }

    /**
     * Add a point to the map
     */
    function addPoint(lat, lon, label) {
        const id = pointIdCounter++;
        
        const point = {
            id: id,
            lat: lat,
            lon: lon,
            label: label,
            x: lonToPixel(lon),
            y: latToPixel(lat)
        };

        plottedPoints.push(point);
        
        redrawAll();
        updatePointsList();
        
        console.log('Point added:', point);
    }

    /**
     * Redraw all points on canvas
     */
    function redrawAllPoints() {
        plottedPoints.forEach(point => {
            drawPoint(point);
        });
    }

    /**
     * Draw a single point on canvas
     */
    function drawPoint(point) {
        const x = point.x;
        const y = point.y;

        ctx.save();
        
        // Draw point marker
        ctx.fillStyle = '#FF5722';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Draw label
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const labelX = x + 10;
        const labelY = y;
        
        // Label background
        const labelWidth = ctx.measureText(point.label).width + 8;
        ctx.fillStyle = 'rgba(255, 87, 34, 0.9)';
        ctx.fillRect(labelX - 2, labelY - 10, labelWidth, 20);
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.strokeRect(labelX - 2, labelY - 10, labelWidth, 20);
        
        // Label text
        ctx.fillStyle = 'white';
        ctx.fillText(point.label, labelX + 2, labelY);
        
        ctx.restore();
    }

    /**
     * Update points list in sidebar
     */
    function updatePointsList() {
        const listEl = document.getElementById('pointsList');
        
        if (plottedPoints.length === 0) {
            listEl.innerHTML = '<div class="points-empty">No points plotted yet</div>';
            return;
        }

        listEl.innerHTML = plottedPoints.map(point => `
            <div class="point-item">
                <div class="point-info">
                    <div class="point-label">${point.label}</div>
                    <div class="point-coords">
                        ${decimalToNautical(point.lat, true)}<br>
                        ${decimalToNautical(point.lon, false)}
                    </div>
                </div>
                <button class="point-delete" onclick="window.deletePoint(${point.id})">
                    Delete
                </button>
            </div>
        `).join('');
    }

    /**
     * Delete a specific point
     */
    function deletePoint(id) {
        plottedPoints = plottedPoints.filter(p => p.id !== id);
        redrawAll();
        updatePointsList();
    }

    /**
     * Clear all points
     */
    function clearAllPoints() {
        if (plottedPoints.length === 0) return;
        
        if (confirm('Clear all plotted points?')) {
            plottedPoints = [];
            pointIdCounter = 0;
            redrawAll();
            updatePointsList();
        }
    }

    /**
     * Clear all and reset
     */
    function clearAll() {
        uploadedImage = null;
        minLat = null;
        maxLat = null;
        minLon = null;
        maxLon = null;
        graticuleGenerated = false;
        plottedPoints = [];
        pointIdCounter = 0;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.classList.remove('active');
        
        document.getElementById('placeholder').style.display = 'flex';
        document.getElementById('imageInfo').style.display = 'none';
        document.getElementById('coordinateDisplay').style.display = 'none';
        document.getElementById('mapUpload').value = '';
        document.getElementById('minLat').value = '';
        document.getElementById('maxLat').value = '';
        document.getElementById('minLon').value = '';
        document.getElementById('maxLon').value = '';
        document.getElementById('gridInterval').value = 30;
        document.getElementById('showMinuteLines').checked = false;
        document.getElementById('generateBtn').disabled = true;
        
        gridIntervalMinutes = 30;
        showMinuteLines = false;
        
        updatePointsList();
        
        console.log('Cleared all');
    }

    // Expose deletePoint to window for inline onclick handlers
    window.deletePoint = deletePoint;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();