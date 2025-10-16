# ============================================
# STAGE 1: Build
# ============================================
FROM node:20-alpine AS builder

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
# STAGE 2: Production
# ============================================
FROM node:20-alpine AS production

# Instalar dumb-init para manejar señales correctamente
RUN apk add --no-cache dumb-init

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

# Exponer puerto (configurable via ENV)
ARG PORT=3030
ENV PORT=${PORT}
EXPOSE ${PORT}

# Variables de entorno (valores por defecto - sobrescribir en runtime)
ENV NODE_ENV=production

# Usar dumb-init para manejar señales
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar la aplicación
CMD ["node", "dist/main.js"]

