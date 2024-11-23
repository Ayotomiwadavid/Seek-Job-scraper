FROM ghcr.io/puppeteer/puppeteer:20.8.0

# Copy your app files into the container
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

# Expose the port and run the app
EXPOSE 8000
CMD ["node", "index.js"]
