# 🚀 Guía de Deployment a Railway usando GitLab CI/CD

Esta guía te ayudará a configurar el deployment automático de tu aplicación a Railway usando GitLab CI/CD.

## 📋 Requisitos Previos

### 1. Cuenta y Proyecto en Railway
- [ ] Cuenta activa en [Railway](https://railway.app)
- [ ] Proyecto creado en Railway
- [ ] **Railway Token** generado
- [ ] **Railway Project ID** disponible

### 2. Repositorio en GitLab
- [ ] Código en GitLab
- [ ] Acceso a Settings -> CI/CD

---

## 🔧 Paso 1: Obtener Credenciales de Railway

### Railway Token

1. Ve a [Railway Account Settings](https://railway.app/account/tokens)
2. Click en **"Create New Token"**
3. Dale un nombre descriptivo: `gitlab-ci-deployment`
4. **Copia el token** (solo se muestra una vez)
5. Guárdalo de forma segura

### Railway Service ID (IMPORTANTE!)

**Necesitas el SERVICE ID, NO el Project ID**

**Cómo obtenerlo:**
1. Abre tu proyecto en Railway
2. Abre el **servicio** que quieres deployar
3. Usa el Command Palette: `Cmd+K` (Mac) o `Ctrl+K` (Windows/Linux)
4. Escribe "copy" y selecciona **"Copy Service ID"**
5. El Service ID se copiará al portapapeles

**Formato:** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

## 🔐 Paso 2: Configurar Variables en GitLab

### 2.1 Acceder a CI/CD Settings

1. Ve a tu proyecto en GitLab
2. Menú lateral: **Settings → CI/CD**
3. Expande la sección **Variables**
4. Click en **Add Variable**

### 2.2 Agregar Variables Requeridas

#### Variable 1: RAILWAY_TOKEN

```
Key:         RAILWAY_TOKEN
Value:       [tu-token-de-railway]
Type:        Variable
Environment: All (default)
Protect:     ✅ Marcado
Mask:        ✅ Marcado
```

#### Variable 2: RAILWAY_SERVICE_ID

```
Key:         RAILWAY_SERVICE_ID
Value:       [tu-service-id]
Type:        Variable
Environment: All (default)
Protect:     ✅ Marcado
Mask:        ❌ No marcado
```

### 2.3 Variables de Aplicación (Opcional)

Si no has configurado estas variables directamente en Railway, agrégalas en GitLab:

#### MCP_PUBLIC_API_KEY
```
Key:         MCP_PUBLIC_API_KEY
Value:       [tu-api-key-segura]
Protect:     ✅ Marcado
Mask:        ✅ Marcado
```

#### OPENAI_API_KEY
```
Key:         OPENAI_API_KEY
Value:       sk-...
Protect:     ✅ Marcado
Mask:        ✅ Marcado
```

#### OPENAI_MODEL
```
Key:         OPENAI_MODEL
Value:       gpt-4o-mini
Protect:     ❌ No marcado
Mask:        ❌ No marcado
```

#### ZEROQ_AUTH_TOKEN (si aplica)
```
Key:         ZEROQ_AUTH_TOKEN
Value:       [tu-token-zeroq]
Protect:     ✅ Marcado
Mask:        ✅ Marcado
```

#### Otras variables requeridas:
- `MCP_TZ` (ej: America/Santiago)
- `OPENAI_MAX_TOKENS` (ej: 2000)
- `OPENAI_TEMPERATURE` (ej: 0.7)
- `NODE_ENV` (production)
- `LOG_LEVEL` (info)

---

## 🏗️ Paso 3: Configurar Railway

### 3.1 Variables de Entorno en Railway

1. Ve a tu proyecto en Railway
2. Click en tu servicio
3. Ve a **Variables**
4. Agrega las variables necesarias (las mismas del `env.example`):

```bash
MCP_PUBLIC_API_KEY=your-secure-key
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7
MCP_TZ=America/Santiago
ZEROQ_BASE_URL=https://zeroq.cl
ZEROQ_API_BASE_URL=https://zeroq.cl/api
ZEROQ_RESERVATIONS_BASE_URL=https://zeroq.cl/services/reservations/api/v3
ZEROQ_BLOCKS_BASE_URL=https://services.zeroq.cl/reservations/api/v3
ZEROQ_AUTH_TOKEN=your-token-if-needed
LOG_LEVEL=info
NODE_ENV=production
```

### 3.2 Configurar Build Settings

Railway debería detectar automáticamente el Dockerfile, pero verifica:

1. **Build Configuration:**
   - Builder: `Dockerfile`
   - Build Command: (vacío, usa Dockerfile)

2. **Deploy Configuration:**
   - Start Command: (vacío, usa Dockerfile CMD)

3. **Health Check:**
   - Path: `/health`
   - Port: El puerto será asignado automáticamente por Railway ($PORT)

---

## 🚀 Paso 4: Ejecutar Deployment

### 4.1 Primera vez (Setup Inicial)

1. Haz commit del archivo `.gitlab-ci.yml`:
   ```bash
   git add .gitlab-ci.yml
   git commit -m "feat: add Railway deployment pipeline"
   git push origin develop
   ```

2. Ve a **GitLab → CI/CD → Pipelines**
3. Verás el pipeline corriendo automáticamente
4. El stage `build` y `lint` se ejecutarán automáticamente
5. El stage `deploy:development` estará en estado **manual**

### 4.2 Deploy a Development

1. Ve a **GitLab → CI/CD → Pipelines**
2. Click en el pipeline más reciente
3. En el stage `deploy`, click en el botón **▶️ Play** del job `deploy:development`
4. Confirma el deployment
5. Espera a que termine (2-5 minutos)

### 4.3 Deploy a Production

1. Haz merge de `develop` a `main` o `master`
2. Ve a **GitLab → CI/CD → Pipelines**
3. Click en el pipeline de la rama `main`/`master`
4. En el stage `deploy`, click en el botón **▶️ Play** del job `deploy:production`
5. Confirma el deployment
6. Espera a que termine

---

## 🔍 Verificación del Deployment

### 1. En GitLab

1. Ve al pipeline y verifica que todos los jobs estén en verde ✅
2. Revisa los logs del job `deploy:development` o `deploy:production`
3. Busca el mensaje: `✅ Deployment completado exitosamente`

### 2. En Railway

1. Ve a tu proyecto en Railway
2. Click en tu servicio
3. Ve a **Deployments**
4. Verifica que el último deployment esté activo
5. Click en el deployment para ver logs en tiempo real

### 3. Verificar la Aplicación

1. Obtén la URL de tu aplicación en Railway:
   - Railway Dashboard → Tu servicio → Settings → Domains
   - URL generada: `https://[tu-app].railway.app`

2. Verifica el health check:
   ```bash
   curl https://[tu-app].railway.app/health
   ```
   
   Respuesta esperada:
   ```json
   {
     "status": "ok",
     "timestamp": "2025-10-16T...",
     "uptime": 123.456,
     "environment": "production"
   }
   ```

3. Verifica el endpoint de documentación MCP:
   ```bash
   curl https://[tu-app].railway.app/mcp/tools
   ```

---

## 🎯 Flujo de Trabajo Recomendado

### Para Features Nuevos

```bash
# 1. Crear rama de feature
git checkout -b feature/nueva-funcionalidad

# 2. Desarrollar y commitear
git add .
git commit -m "feat: descripción del cambio"

# 3. Push a GitLab
git push origin feature/nueva-funcionalidad

# 4. Crear Merge Request a develop
# (desde la interfaz de GitLab)

# 5. Una vez aprobado y mergeado a develop:
# El pipeline se ejecutará automáticamente
# Deploy a development es MANUAL - click en Play

# 6. Probar en el ambiente de development

# 7. Si todo está OK, crear Merge Request de develop a main
# Deploy a production es MANUAL - click en Play
```

---

## 🐛 Troubleshooting

### Error: "RAILWAY_TOKEN no está configurado"

**Solución:**
1. Verifica que agregaste `RAILWAY_TOKEN` en GitLab → Settings → CI/CD → Variables
2. Verifica que la variable esté marcada como **Protected**
3. Si estás en una rama no protegida, desactiva temporalmente "Protected"

### Error: "railway: command not found"

**Solución:**
- El pipeline instala Railway CLI automáticamente
- Si ves este error, verifica que el stage `before_script` se esté ejecutando

### El deployment tarda mucho

**Causas comunes:**
1. **Primera vez:** Railway está construyendo la imagen Docker (5-10 min)
2. **Build cache:** Posteriores builds serán más rápidos (2-3 min)
3. **Dependencias grandes:** El build de node_modules puede tardar

### La aplicación no inicia en Railway

**Verificar:**
1. **Logs en Railway:** Ve a Deployments → Click en el deployment → View Logs
2. **Variables de entorno:** Verifica que todas las variables necesarias estén configuradas
3. **Health check:** Verifica que `/health` responda correctamente
4. **Puerto:** Railway asigna automáticamente el puerto via `$PORT`

### Error: "Build failed"

**Solución:**
1. Revisa los logs del job `build` en GitLab
2. Ejecuta localmente: `yarn build`
3. Corrige errores de TypeScript
4. Commitea y pushea de nuevo

---

## 📊 Configuración de Environments en GitLab

Para una mejor visualización de los deployments:

1. Ve a **GitLab → Deployments → Environments**
2. Configura las URLs:
   - **development:** URL de Railway del ambiente de desarrollo
   - **production:** URL de Railway del ambiente de producción

---

## 🔄 Actualizaciones del Pipeline

Si necesitas modificar el pipeline:

1. Edita `.gitlab-ci.yml`
2. Commitea los cambios:
   ```bash
   git add .gitlab-ci.yml
   git commit -m "ci: actualizar configuración del pipeline"
   git push
   ```
3. El nuevo pipeline se ejecutará automáticamente

---

## 📚 Referencias

- [Railway Docs](https://docs.railway.app/)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [GitLab CI/CD Docs](https://docs.gitlab.com/ee/ci/)
- [GitLab CI/CD Variables](https://docs.gitlab.com/ee/ci/variables/)

---

## ✅ Checklist Final

Antes de hacer el primer deployment, verifica:

- [ ] Railway Token generado y agregado en GitLab
- [ ] Railway Project ID agregado en GitLab
- [ ] Variables de entorno configuradas en Railway
- [ ] Variables de entorno configuradas en GitLab (si es necesario)
- [ ] Archivo `.gitlab-ci.yml` commiteado y pusheado
- [ ] Dockerfile presente en el repositorio
- [ ] Rama `develop` o `main` configurada
- [ ] Health check endpoint funcionando localmente
- [ ] URLs de los environments actualizadas en el `.gitlab-ci.yml`

---

## 🎉 ¡Listo!

Una vez configurado todo, tu aplicación se desplegará automáticamente a Railway cada vez que hagas push a las ramas configuradas (después de aprobar el deployment manual).

**Recuerda:** Los deployments son **manuales** por seguridad. Debes hacer click en el botón Play para iniciar cada deployment.

Si tienes algún problema, revisa la sección de Troubleshooting o consulta los logs en GitLab y Railway.

