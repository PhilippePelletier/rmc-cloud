# worker/Dockerfile
FROM python:3.11-slim

# Keep image small & pip fast
ENV PIP_NO_CACHE_DIR=1 PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# ---- OS deps for WeasyPrint (PDF) ----
# libcairo2, pango, gdk-pixbuf, libffi runtime, jpeg, fonts, MIME db
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi8 \
    libjpeg62-turbo \
    fonts-liberation \
    shared-mime-info \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# If your requirements.txt includes "uvicorn[standard]" and "weasyprint"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the whole app (safer for future changes)
COPY . .

# Railway provides $PORT dynamically
ENV PORT=8000

# Optional: basic liveness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD \
  wget -qO- http://127.0.0.1:${PORT}/health || exit 1

# IMPORTANT: if your main file is NOT app.py, change to "main:app" (module:variable)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
