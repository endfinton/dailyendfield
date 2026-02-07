# 🚀 Guía de Subida a GitHub

## Paso 1: Configura Git (Solo primera vez)

Abre la terminal y ejecuta:

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-email@example.com"
```

## Paso 2: Crea el Repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre: `EndfieldAutorun`
3. Descripción: "Arknights: Endfield Auto Check-In Service"
4. Público o Privado (tú decides)
5. **NO marques** "Initialize with README"
6. Click en "Create repository"

## Paso 3: Sube el Código

Copia y pega estos comandos en la terminal (desde la carpeta del proyecto):

```bash
cd "e:\Lex Projects\EndfieldAutorun"

# Agregar todos los archivos
git add .

# Hacer commit
git commit -m "Initial commit: Endfield Auto Check-In Service"

# Conectar con GitHub (reemplaza TU-USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU-USUARIO/EndfieldAutorun.git

# Cambiar a rama main
git branch -M main

# Subir código
git push -u origin main
```

## Paso 4: Verificar

Ve a tu repositorio en GitHub y deberías ver todos los archivos subidos.

---

# 🐳 Docker Run para Dockge

Una vez que el código esté en GitHub, puedes usar estos comandos en Dockge:

## Opción 1: Docker Compose desde GitHub

Crea un nuevo stack en Dockge y pega esto:

```yaml
version: '3.8'
services:
  endfield:
    build: https://github.com/TU-USUARIO/EndfieldAutorun.git
    container_name: endfield-auto-checkin
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=UTC
```

## Opción 2: Clone + Docker Compose

```bash
# 1. Clonar repo
git clone https://github.com/TU-USUARIO/EndfieldAutorun.git
cd EndfieldAutorun

# 2. Iniciar con docker-compose
docker-compose up -d
```

## Opción 3: Docker Run Directo

```bash
# Build desde GitHub
docker build -t endfield-autorun https://github.com/TU-USUARIO/EndfieldAutorun.git

# Run
docker run -d \
  --name endfield-auto-checkin \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e TZ=UTC \
  endfield-autorun
```

---

## 📝 Notas

- Reemplaza `TU-USUARIO` con tu nombre de usuario de GitHub
- El servicio estará disponible en: http://localhost:3000
- Los datos se guardan en la carpeta `data/` (persistente)
- Check-in automático a las 20:00 UTC diariamente

¡Listo! 🎉
