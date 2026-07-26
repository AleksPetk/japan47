FROM python:3.14-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# Run the API as an unprivileged account; uploaded media remains writable via
# the mounted volume prepared below.
RUN addgroup --system django && adduser --system --ingroup django django
COPY backend/requirements/production.txt backend/requirements/base.txt /tmp/requirements/
RUN python -m pip install --upgrade pip && python -m pip install -r /tmp/requirements/production.txt
COPY backend/ /app/
RUN chmod +x /app/docker-entrypoint.sh && mkdir -p /app/staticfiles /app/media && chown -R django:django /app
USER django
EXPOSE 8000
# The probe runs inside the container, but production deliberately rejects
# 127.0.0.1 may not be a trusted public host. Reuse BACKEND_URL's configured
# host and scheme so the same probe works in Docker-local and production.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import os, urllib.parse, urllib.request; origin = urllib.parse.urlsplit(os.environ['BACKEND_URL']); request = urllib.request.Request('http://127.0.0.1:8000/api/v1/health/', headers={'Host': origin.netloc, 'X-Forwarded-Proto': origin.scheme}); urllib.request.urlopen(request, timeout=3)"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60", "--access-logfile", "-"]
