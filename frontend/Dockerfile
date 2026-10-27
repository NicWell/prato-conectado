# Build imutável do frontend com Vite e publicação estática via Nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Mock é a única integração nesta sprint. Para integrar API, ajustar antes do build.
ARG VITE_MOCK_MODE=true
ENV VITE_MOCK_MODE=$VITE_MOCK_MODE
RUN npm run build

FROM nginx:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
