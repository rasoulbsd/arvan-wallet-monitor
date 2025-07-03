FROM node:23-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# No default CMD; docker-compose.yml will specify the command
