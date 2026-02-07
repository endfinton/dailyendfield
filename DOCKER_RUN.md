# Docker Run Command for Dockge

## 📦 Pull de Docker Hub (Próximamente)

Si publicas la imagen en Docker Hub:

```bash
docker run -d \
  --name endfield-auto-checkin \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e TZ=UTC \
  tu-usuario/endfield-autorun:latest
```

## 🔧 Build Local + Run

Si prefieres hacer build localmente:

```bash
# 1. Build la imagen
docker build -t endfield-autorun .

# 2. Run el contenedor
docker run -d \
  --name endfield-auto-checkin \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e TZ=UTC \
  endfield-autorun
```

## 🐙 Usando Docker Compose (Recomendado)

El método más simple es usar `docker-compose.yml`:

```bash
docker-compose up -d
```

## 📋 Parámetros del Docker Run

| Parámetro | Descripción |
|-----------|-------------|
| `-d` | Run en background (detached) |
| `--name endfield-auto-checkin` | Nombre del contenedor |
| `--restart unless-stopped` | Auto-restart |
| `-p 3000:3000` | Puerto del dashboard |
| `-v $(pwd)/data:/app/data` | Persistencia de BD |
| `-e TZ=UTC` | Timezone |

## 🎯 Para Dockge

### Opción 1: Desde Docker Hub

```yaml
version: '3.8'
services:
  endfield:
    image: tu-usuario/endfield-autorun:latest
    container_name: endfield-auto-checkin
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=UTC
```

### Opción 2: Build desde GitHub

```yaml
version: '3.8'
services:
  endfield:
    build: https://github.com/tu-usuario/EndfieldAutorun.git
    container_name: endfield-auto-checkin
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=UTC
```

## 🚀 Acceso

Una vez ejecutado, abre: **http://localhost:3000**
