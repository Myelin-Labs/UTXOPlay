FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY dist ./dist
COPY server ./server
COPY games/chess/web ./games/chess/web
COPY games/sling/web ./games/sling/web
COPY games/teeworlds/web ./games/teeworlds/web
COPY deploy/bin ./bin
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production BIND=0.0.0.0 PORT=8790 DATA_DIR=/app/data
EXPOSE 8790
CMD ["node", "server/index.mjs"]
