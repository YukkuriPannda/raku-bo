FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 8081

CMD ["npx", "expo", "start", "--port", "8081", "--host", "lan", "--clear"]
