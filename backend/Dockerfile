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
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/', timeout=3)"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60", "--access-logfile", "-"]
