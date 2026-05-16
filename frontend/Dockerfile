# syntax=docker/dockerfile:1.7

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

COPY . .
RUN npm run build

# ---- Stage 2: runtime ----
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html

# - SPA fallback
# - index.html sem cache (PWA puxa novo manifest a cada deploy)
# - assets com hash → cache imutável
# - service worker e manifest sem cache
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  add_header X-Content-Type-Options "nosniff" always;' \
  '  add_header X-Frame-Options "DENY" always;' \
  '' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '' \
  '  location = /index.html {' \
  '    add_header Cache-Control "no-cache, no-store, must-revalidate" always;' \
  '    add_header Pragma "no-cache" always;' \
  '    add_header Expires "0" always;' \
  '  }' \
  '' \
  '  location ~* /(sw\.js|manifest\.webmanifest|registerSW\.js)$ {' \
  '    add_header Cache-Control "no-cache, no-store, must-revalidate" always;' \
  '    add_header Pragma "no-cache" always;' \
  '    add_header Expires "0" always;' \
  '  }' \
  '' \
  '  location ~* \.(?:js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$ {' \
  '    expires 30d;' \
  '    access_log off;' \
  '    add_header Cache-Control "public, max-age=2592000, immutable" always;' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
# Alpine resolve "localhost" para IPv6 primeiro; o server block escuta só IPv4,
# por isso usamos 127.0.0.1 explicitamente para evitar flapping do healthcheck.
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
