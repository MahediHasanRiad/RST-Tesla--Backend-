FROM node:22-alpine

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
RUN npm run prisma:generate && npm run build

EXPOSE 3001
CMD ["node", "dist/server.js"]
