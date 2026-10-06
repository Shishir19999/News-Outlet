FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
RUN mkdir -p public/news public/users && chown -R node:node public
# Uploaded images live in public/news and public/users (mounted as volumes in docker-compose.yml)
EXPOSE 8080
USER node
CMD ["node", "src/index.js"]
