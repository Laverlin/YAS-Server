FROM node:alpine

# Copy source code
COPY . /app

# Change working directory
WORKDIR /app

RUN ls -la

RUN npm config set strict-ssl false
RUN npm install --global typescript

# Install dependencies
RUN npm install

RUN sh -c tsc app.ts

EXPOSE 3000
CMD ["node", "--max_old_space_size=180", "app.js"]