# Building layer
FROM denoland/deno:1.42.1 as build

WORKDIR /app

# Copy configuration files
COPY package*.json ./

# Install dependencies
RUN deno install package.json

# Copy the rest of the application code to the container
COPY . .

# Set environment variables
ARG GIT_COMMIT_SHA
ENV GIT_COMMIT_SHA $GIT_COMMIT_SHA
