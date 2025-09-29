FROM python:3.11-slim

# Install WeasyPrint system deps (fonts, cairo, pango, harfbuzz, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libjpeg62-turbo \
    libopenjp2-7 \
    libpng16-16 \
    libharfbuzz0b \
    libfribidi0 \
    fonts-liberation \
    shared-mime-info \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8080
# IMPORTANT: bind to $PORT (Railway sets it at runtime)
CMD sh -c 'uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080}'

# Optional: basic liveness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD \
  wget -qO- http://127.0.0.1:${PORT}/health || exit 1

