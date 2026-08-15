FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:5080/api/v1
ARG VITE_APP_NAME=eDMS
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
