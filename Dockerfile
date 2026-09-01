# 1. Use Node.js 20 Alpine for lightweight and reproducible builds
FROM node:20-alpine

# 2. Set the working directory inside container
WORKDIR /usr/src/app

# 3. Copy dependency manifests
COPY package*.json ./

# 4. Install dependencies cleanly
RUN npm ci --only=production || npm install

# 5. Copy application source code
COPY . .

# 6. Expose API port
EXPOSE 3000

# 7. Start server
CMD ["node", "server.js"]