FROM node:18-bullseye

# Install ffmpeg and python3 (for yt-dlp)
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp and curl-cffi via pip to handle TikTok impersonation and IP blocks
RUN pip3 install -U pip && \
    pip3 install -U yt-dlp curl-cffi

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Expose port
EXPOSE 4000

# Start server
CMD ["npm", "start"]
