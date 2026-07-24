# Japan 47 migration checklist

- [x] Inventory legacy settings, URLs, models, views, forms, templates, assets, media, tests, database, and repository state.
- [x] Preserve the copied SQLite database, all 91 media files, migrations, admin, services, and user-facing content during migration.
- [x] Separate `backend/` and `frontend/`.
- [x] Add environment-aware development, test, and production settings.
- [x] Add `/api/v1/`, JWT refresh/blacklist auth, permissions, filtering, search, ordering, pagination, consistent errors, health, schema, and Swagger.
- [x] Migrate forms and validation to serializers plus React forms, including multipart uploads.
- [x] Preserve moderation, equal-weight ratings, and contributor points/badges.
- [x] Remove the retired website assistant, its endpoint, provider integration, UI, configuration, dependency, and tests.
- [x] Replace every routed public Django page and mutation flow with React Router pages.
- [x] Remove the superseded Django templates, HTML views, forms, URLconf, legacy tests, CSS, JavaScript, and duplicate presentation assets after verification.
- [x] Add responsive styling, mobile navigation, accessible states, and field errors.
- [x] Add PostgreSQL, Redis, Gunicorn, Nginx, Docker Compose, persistent volumes, and a guarded fixture-based cutover procedure.
- [x] Complete Django checks, API/frontend tests, lint, warning-free OpenAPI validation, production build, uploads/thumbnails, auth, admin, and SQLite/media integrity verification.
- [ ] Run the Docker/PostgreSQL/Nginx persistence smoke test on a host with Docker installed (Docker is unavailable on the current machine).
- [ ] Complete owner-controlled launch work: domain/DNS/HTTPS, deployed screenshots and demo video, portfolio publication, and CV entry.
