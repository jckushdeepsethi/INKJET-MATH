# Stage 1: Build Vite Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/calc-fe

COPY calc-fe/package*.json ./
RUN npm install

COPY calc-fe/ ./
RUN npm run build

# Stage 2: Python Backend & Unified Runner
FROM python:3.10-slim AS runner
WORKDIR /app

# Upgrade pip and install Python requirements
COPY calc-be/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY calc-be/ ./

# Copy compiled frontend from stage 1 into backend directory
COPY --from=frontend-builder /app/calc-fe/dist ./dist

ENV PORT=8900
ENV SERVER_URL=0.0.0.0
ENV ENV=production

EXPOSE 8900

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8900}"]
