# 🚀 Guía de Deployment a Railway usando GitLab Container Registry

Esta guía te ayudará a desplegar tu aplicación a Railway usando imágenes Docker desde GitLab Container Registry.

## 📋 Resumen del Proceso

1. **GitLab CI/CD** construye la imagen Docker
2. La imagen se pushea al **GitLab Container Registry**
3. **Railway** pullea y despliega la imagen automáticamente

---

## 🎯 Ventajas de Este Método

- ✅ **Más simple** - No requiere Railway CLI ni tokens de Railway en GitLab
- ✅ **Más confiable** - GitLab maneja el build y caching
- ✅ **Más control** - Ves todo el proceso de build en GitLab
- ✅ **Auto-deploy** - Railway se actualiza cuando hay nueva imagen
- ✅ **Build optimizado** - Multi-stage Dockerfile reduce tamaño de imagen

---

## 🔧 Paso 1: Ejecutar Build en GitLab

### 1.1 Ir a Pipelines

1. Ve a tu proyecto en GitLab
2. Menú lateral: **CI/CD → Pipelines**
3. Verás el pipeline más reciente

### 1.2 Ejecutar Docker Build

1. Espera que el stage **`build`** termine (automático, ~1-2 min)
2. En el stage **`deploy`**, verás el job **`docker:build`**
3. Click en el botón **▶️ Play** (es manual por seguridad)
4. El job comenzará a construir la imagen

### 1.3 Monitorear el Build

El proceso toma **3-5 minutos** y verás:

```bash
🔐 Autenticando con GitLab Container Registry...
Login Succeeded

🏗️ Construyendo imagen Docker...
📦 Image tag - registry.gitlab.com/zeroq/reservations-mcp:abc1234
[+] Building Docker image...
  ✓ Stage 1: Build (instalar deps, compilar TypeScript)
  ✓ Stage 2: Production (imagen optimizada)

📤 Pusheando imagen a GitLab Container Registry...
The push refers to repository [registry.gitlab.com/zeroq/reservations-mcp]
latest: digest: sha256:xxxxx size: 1234

✅ Imagen publicada exitosamente
🎯 Imagen disponible en - registry.gitlab.com/zeroq/reservations-mcp
📌 Tag SHA - abc1234
📌 Tag Latest - latest
```

---

## 🚂 Paso 2: Conectar Imagen en Railway

### 2.1 Acceder a tu Proyecto

1. Ve a [Railway Dashboard](https://railway.app)
2. Abre tu proyecto
3. Si aún no tienes un servicio, click en **"New Service"** o **"Add a Service"**

### 2.2 Conectar la Imagen Docker

1. En el servicio, ve a **Settings → Source**
2. Click en **"Connect Image"** o **"Deploy from Image"**
3. Ingresa la URL de tu imagen:
   ```
   registry.gitlab.com/zeroq/reservations-mcp:latest
   ```

### 2.3 Autenticación (Si el Registry es Privado)

Si Railway te pide credenciales, necesitas crear un **Deploy Token** en GitLab:

#### A. Crear Deploy Token en GitLab

1. Ve a **GitLab → Settings → Repository → Deploy Tokens**
2. Click en **"Add token"**
3. Configuración:
   ```
   Name:        railway-deploy
   Expiration:  (opcional, déjalo vacío o pon fecha lejana)
   Scopes:      ✅ read_registry
   ```
4. Click en **"Create deploy token"**
5. **¡IMPORTANTE!** Copia el **username** y **token** inmediatamente
   - Solo se muestran una vez
   - Formato username: `gitlab+deploy-token-xxxxx`
   - Formato token: `gldt-xxxxxxxxxx`

#### B. Configurar en Railway

1. En Railway, cuando conectes la imagen, te pedirá autenticación
2. Ingresa:
   ```
   Registry Username: gitlab+deploy-token-xxxxx
   Registry Password: gldt-xxxxxxxxxx
   ```
3. Railway validará las credenciales

### 2.4 Configurar Variables de Entorno

En Railway → Tu Servicio → **Variables**, agrega todas las variables necesarias:

```bash
# Seguridad
MCP_PUBLIC_API_KEY=tu-key-segura

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# ZeroQ APIs
ZEROQ_BASE_URL=https://zeroq.cl
ZEROQ_API_BASE_URL=https://zeroq.cl/api
ZEROQ_RESERVATIONS_BASE_URL=https://zeroq.cl/services/reservations/api/v3
ZEROQ_BLOCKS_BASE_URL=https://services.zeroq.cl/reservations/api/v3
ZEROQ_AUTH_TOKEN=(si lo tienes)

# General
MCP_TZ=America/Santiago
NODE_ENV=production
LOG_LEVEL=info
```

### 2.5 Configurar Puerto (Opcional)

Railway detecta automáticamente el puerto del Dockerfile (`3030`), pero si necesitas cambiarlo:

1. En Railway → Variables
2. Agrega:
   ```
   PORT=3030
   ```

Railway expone automáticamente este puerto al público.

---

## ✅ Paso 3: Verificar el Deployment

### 3.1 En Railway

1. Ve a **Deployments** en tu servicio
2. Deberías ver el deployment en progreso
3. Espera 2-3 minutos mientras:
   - Railway pullea la imagen
   - Inicia el contenedor
   - Ejecuta health checks

### 3.2 Verificar Logs

1. Click en el deployment activo
2. Ve a **View Logs**
3. Deberías ver:
   ```
   [Nest] Starting Nest application...
   [Nest] MCP Tools Reserve initialized
   [Nest] Application is running on: http://0.0.0.0:3030
   ```

### 3.3 Obtener URL Pública

1. En Railway, ve a **Settings → Domains**
2. Railway genera automáticamente una URL:
   ```
   https://[tu-servicio].railway.app
   ```
3. O puedes agregar un dominio custom

### 3.4 Probar la Aplicación

#### Health Check
```bash
curl https://[tu-servicio].railway.app/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-16T...",
  "uptime": 123.456,
  "environment": "production",
  "config": {
    "port": 3030,
    "timezone": "America/Santiago",
    "openai": {
      "model": "gpt-4o-mini",
      "maxTokens": 2000
    },
    "zeroq": {
      "configured": true
    }
  }
}
```

#### Listar Herramientas MCP
```bash
curl https://[tu-servicio].railway.app/mcp/tools
```

**Respuesta esperada:**
```json
{
  "tools": [
    {
      "name": "list_web_offices",
      "description": "Lista todas las oficinas web disponibles"
    },
    {
      "name": "get_office_details",
      "description": "Obtiene detalles de una oficina específica"
    },
    // ... más herramientas
  ]
}
```

---

## 🔄 Workflow de Actualizaciones

### Cuando hagas cambios al código:

```bash
# 1. Hacer cambios y commit
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main

# 2. GitLab CI/CD automáticamente:
#    - Ejecuta el build
#    - Espera tu confirmación en docker:build

# 3. En GitLab → Pipelines:
#    - Click en ▶️ Play en docker:build
#    - Espera que termine (3-5 min)

# 4. Railway automáticamente:
#    - Detecta la nueva imagen
#    - Pullea la imagen actualizada
#    - Redeploya el servicio
#    - ¡Listo! 🎉
```

### Auto-redeploy en Railway

Railway puede configurarse para hacer redeploy automático:

1. Ve a **Settings → Deployments**
2. Activa **"Watch for image changes"**
3. Railway checkeará el registry periódicamente
4. Cuando detecte nueva imagen con tag `latest`, redeployará automáticamente

---

## 🐛 Troubleshooting

### Build falla en GitLab

**Error: "Could not find TypeScript configuration file"**

✅ **Solución:** Ya está resuelto. Los archivos `tsconfig.json`, `tsconfig.build.json` y `nest-cli.json` están incluidos en la imagen.

**Error: "docker: command not found"**

✅ **Solución:** El pipeline usa `image: docker:24-cli` y `services: docker:24-dind`. No necesitas hacer nada.

### Railway no puede pullear la imagen

**Error: "authentication required"**

**Solución:**
1. Crea un Deploy Token en GitLab (ver Paso 2.3)
2. Usa las credenciales en Railway
3. Verifica que el token tenga el scope `read_registry`

### La aplicación no inicia en Railway

**Verificar:**

1. **Logs en Railway:**
   - Ve a Deployments → Click en el deployment → View Logs
   - Busca errores de inicio

2. **Variables de entorno:**
   - Verifica que todas las variables estén configuradas
   - Especialmente `OPENAI_API_KEY` y `MCP_PUBLIC_API_KEY`

3. **Puerto:**
   - Railway detecta automáticamente el puerto 3030
   - Si cambias el puerto, actualiza también el Dockerfile

4. **Health check:**
   - El Dockerfile tiene un health check en `/health`
   - Railway lo usa para verificar que la app esté funcionando

### Railway muestra "Crashed"

**Causas comunes:**

1. **Variables de entorno faltantes**
   - Revisa los logs para ver qué variable falta
   - Agrega en Railway → Variables

2. **Error en el código**
   - Revisa los logs de Railway
   - Verifica que el build en GitLab haya sido exitoso

3. **Puerto incorrecto**
   - Railway asigna `$PORT` automáticamente
   - El Dockerfile ya está configurado para usar `$PORT`

---

## 📊 Monitoreo y Métricas

### En Railway

1. **Deployments:** Historial de deployments y rollback
2. **Metrics:** CPU, memoria, requests
3. **Logs:** Logs en tiempo real y históricos
4. **Events:** Eventos del servicio

### Health Checks

El Dockerfile incluye un health check automático:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1
```

Railway usa esto para:
- Verificar que la app esté funcionando
- Reiniciar automáticamente si falla
- Mostrar status en la dashboard

---

## 🔒 Seguridad

### Mejores Prácticas

1. **Variables de entorno sensibles:**
   - Nunca las commites al código
   - Configúralas solo en Railway
   - Usa valores diferentes para dev y prod

2. **Deploy Tokens:**
   - Usa scopes mínimos (`read_registry` únicamente)
   - Establece fecha de expiración
   - Rota regularmente

3. **API Keys:**
   - Usa API keys específicas para producción
   - Monitorea uso en OpenAI y ZeroQ
   - Rota regularmente

4. **Imagen Docker:**
   - Multi-stage build reduce superficie de ataque
   - Usuario no-root (`nodejs`) en producción
   - Solo archivos necesarios en imagen final

---

## 📚 Recursos Adicionales

- [Railway Documentation](https://docs.railway.app/)
- [GitLab Container Registry Docs](https://docs.gitlab.com/ee/user/packages/container_registry/)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [NestJS Documentation](https://docs.nestjs.com/)

---

## ✅ Checklist de Deployment

Antes de hacer el deployment, verifica:

### GitLab
- [ ] Pipeline ejecutándose correctamente
- [ ] Job `build` termina exitosamente
- [ ] Job `docker:build` construye y pushea imagen
- [ ] Imagen visible en GitLab Container Registry

### Railway
- [ ] Proyecto creado
- [ ] Servicio conectado a la imagen
- [ ] Deploy Token configurado (si es privado)
- [ ] Variables de entorno configuradas
- [ ] Dominio configurado (opcional)

### Verificación
- [ ] Health check responde correctamente
- [ ] Logs muestran inicio exitoso
- [ ] Endpoints de MCP responden
- [ ] Sin errores en los logs

---

## 🎉 ¡Listo!

Una vez completado todo, tu aplicación estará:

- ✅ Desplegada en Railway
- ✅ Accesible públicamente vía HTTPS
- ✅ Con auto-redeploy cuando pushees cambios
- ✅ Monitoreada con health checks
- ✅ Con logs centralizados

**¡Felicidades por completar el deployment! 🚀**

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs en Railway
2. Verifica el pipeline en GitLab
3. Consulta la sección de Troubleshooting
4. Revisa los recursos adicionales

---

**Última actualización:** Octubre 2025
**Versión del pipeline:** 1.0.0
