# ---------- STAGE 1: Build Vite app ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------- STAGE 2: Serve with Nginx ----------
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY senvia.conf /etc/nginx/conf.d/senvia.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
