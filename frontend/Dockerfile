FROM node:24-alpine AS build
WORKDIR /app
# npm ci makes the frontend build reproducible from the committed lock file.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_PUBLIC_URL=http://localhost
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL
RUN npm run build

FROM nginx:1.29-alpine
# This inner Nginx serves only immutable React build output. The public Nginx
# container owns API proxying, media, and deployment-level security headers.
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/
