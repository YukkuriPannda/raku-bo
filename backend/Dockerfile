FROM node:20-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 8787

CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]
