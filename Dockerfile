# 1. Use an official Node.js runtime as a parent image
FROM node:latest

# 2. Set the working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json first
# (This helps Docker cache the installed modules to make builds faster)
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy the rest of your application code
COPY . .

# 6. Expose the port the app runs on
EXPOSE 3000

# 7. Define the command to run your app
CMD ["node", "server.js"]