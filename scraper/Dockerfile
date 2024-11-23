# Use official Node.js image as the base image
FROM node:18-slim

# Set the working directory inside the container
WORKDIR /app

# Install necessary dependencies for Puppeteer (Chromium)
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json package-lock.json /app/
RUN npm install

# Install Puppeteer browsers
RUN npx puppeteer browsers install

# Copy the rest of the application code
COPY . /app/

# Expose the port the app will run on
EXPOSE 8000

# Start the app
CMD ["npm", "start"]
