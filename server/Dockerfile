FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json ./server/package.json
RUN npm install -w server
COPY server ./server
WORKDIR /app/server
ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
RUN npm run prisma:generate
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
