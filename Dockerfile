# ============================================
# STAGE 1: Build
# ============================================
FROM node:22-alpine AS builder

# Instalar dependencias necesarias para compilación
RUN apk add --no-cache python3 make g++

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json yarn.lock ./

# Instalar dependencias (incluyendo devDependencies para build)
RUN yarn install --frozen-lockfile

# Copiar código fuente
COPY . .

# Compilar la aplicación
RUN yarn build

# Limpiar devDependencies
RUN yarn install --production --frozen-lockfile && yarn cache clean

# ============================================
# STAGE 2: Production (Railway Optimized)
# ============================================
FROM node:22-alpine AS production

# Instalar dumb-init para manejar señales correctamente
RUN apk add --no-cache dumb-init curl

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Cambiar permisos
RUN chown -R nodejs:nodejs /app

# Copiar node_modules y build desde stage anterior
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Cambiar a usuario no-root
USER nodejs

# Railway maneja automáticamente el puerto via $PORT
# No es necesario EXPOSE ya que Railway lo detecta automáticamente
ARG PORT=3030
ENV PORT=${PORT}

# Solo NODE_ENV por defecto, el resto se configuran desde Railway
ENV NODE_ENV=production

# Health check (Railway puede usarlo para verificar el estado)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Usar dumb-init para manejar señales
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar la aplicación
CMD ["node", "dist/main.js"]

