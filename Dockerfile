# Use Python 3.11 slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY nav_app/ /app/

# Collect static files. No database is configured at build time, so settings.py
# must import without one; a failure here means static assets would 404 at runtime.
RUN python manage.py collectstatic --noinput

# Create directory for media files
RUN mkdir -p /app/media

# Expose port
EXPOSE 8000

# Render injects PORT (default 10000) and offers no pre-deploy hook on the free
# plan, so migrations run here. Shell form is required to expand $PORT.
CMD python manage.py migrate --noinput && \
    exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120 nav_app.wsgi:application