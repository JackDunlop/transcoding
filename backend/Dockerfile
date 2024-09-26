# Use the specified Node.js version with Alpine
FROM node:20.10.0-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install FFmpeg and timezone data
RUN apk add --no-cache ffmpeg tzdata

# Set the timezone to Australia/Brisbane
ENV TZ=Australia/Brisbane

# Link the timezone configuration
RUN cp /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Copy the rest of the application code
COPY . .

# Expose the application port
EXPOSE 3001

# Command to run the application
CMD ["npm", "start"]
