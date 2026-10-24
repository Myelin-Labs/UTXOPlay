FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY dist ./dist
COPY server ./server
COPY tools/community-moderate.mjs ./tools/community-moderate.mjs
COPY shared ./shared
COPY games/chess/web ./games/chess/web
COPY games/sling/web ./games/sling/web
COPY games/teeworlds/web ./games/teeworlds/web
COPY games/openstrike/web ./games/openstrike/web
COPY games/neon-miner/web ./games/neon-miner/web
COPY games/arcade/web ./games/arcade/web
COPY games/prism-breaker/web ./games/prism-breaker/web
COPY games/neon-coil/web ./games/neon-coil/web
COPY games/starfall/web ./games/starfall/web
COPY games/drift-run/web ./games/drift-run/web
COPY deploy/bin ./bin
RUN find /app/dist /app/games -type d -exec chmod 755 {} + && find /app/dist /app/games -type f -exec chmod 644 {} +
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production BIND=0.0.0.0 PORT=8790 DATA_DIR=/app/data
EXPOSE 8790
CMD ["node", "server/index.mjs"]
