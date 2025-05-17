# Stage 1: Build the application
FROM node:23-alpine AS builder
# Use a specific LTS version, alpine for smaller image size

WORKDIR /usr/src/app

# Install pnpm if you prefer it for faster installs and efficient disk space usage
# RUN npm install -g pnpm

# Copy package.json and package-lock.json (or pnpm-lock.yaml)
COPY package*.json ./
# COPY pnpm-lock.yaml ./ # If using pnpm

# Install dependencies
# Use --frozen-lockfile (npm) or --frozen-lockfile (pnpm) for reproducible builds
RUN npm ci --omit=dev
# RUN pnpm install --frozen-lockfile --prod # If using pnpm

# Copy the rest of the application source code
COPY . .

# Build the TypeScript application
# Ensure your tsconfig.json has "outDir": "./dist" and "rootDir": "./src"
RUN npm run build
# If build script also runs clean: rimraf dist && tsc, it's fine

# Stage 2: Production image
FROM node:23-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
# Set PORT if not already in .env or if you want to override
# ENV PORT=3000

WORKDIR /usr/src/app

# Copy only necessary files from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
# COPY --from=builder /usr/src/app/package-lock.json ./package-lock.json # If needed by runtime tools, usually not for just 'node server.js'

# Expose the port the app runs on
# This should match the PORT in your .env or server.ts configuration
EXPOSE 3000

# Command to run the application
# This assumes your package.json "start" script is "node dist/server.js"
CMD ["npm", "start"]
# OR directly: CMD [ "node", "dist/server.js" ]