# syntax=docker/dockerfile:1

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY --from=web /web/dist ./static
ENV PYTHONUNBUFFERED=1
EXPOSE 8101
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8101"]
