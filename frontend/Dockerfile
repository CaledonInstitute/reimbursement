FROM node:22-alpine
WORKDIR /app
ARG BACKEND_URL=http://backend:3001
ENV BACKEND_URL=$BACKEND_URL
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
