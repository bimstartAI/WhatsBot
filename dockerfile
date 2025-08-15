# Use an official Node.js runtime as the base image
FROM node:22.13.1

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your app listens on (adjust if needed)
EXPOSE 3000

# Define the command to run your app
CMD ["node", "app.js"]