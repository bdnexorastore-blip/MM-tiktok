FROM node:18-bullseye

# Install ffmpeg and python3 (for yt-dlp)
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

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
