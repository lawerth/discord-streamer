FROM node:22-alpine

WORKDIR /app

# Install dependencies required by node-gyp and native builds if needed
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Generate dummy video if not already present
RUN node -e "import('./src/media.js').then(m => m.ensureDummyMedia())"

CMD ["npm", "start"]
