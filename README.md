# HABITIA

Sistema de gestión de alquileres de estudios: catálogo de estudios, inquilinos, cobros mensuales, gastos, deudores y reportes PDF.

## Desarrollo

```bash
npm install
npm start        # ejecutar en modo desarrollo
npm run smoke    # smoke test del renderer
```

## Generar instalador

```bash
npm run dist     # genera setup NSIS (x64)
npm run dist:all # genera setup NSIS (x64 + ia32)
npm run dist:portable  # versión portable
```

## Publicar release (auto-actualización)

El instalador usa [electron-updater](https://www.electron.build/auto-update) con **GitHub Releases**. Para publicar una nueva versión:

### Opción A — Manual desde la PC

```bash
npm run dist:release
```

Esto genera `HABITIA-Setup-<version>.exe`, `latest.yml` y sube todo a una Release de GitHub. La app instalada detectará la nueva versión al abrirse y ofrecerá actualizarse sola.

> Requiere un token con permiso `public_repo` en `GH_TOKEN` (variables de entorno).

### Opción B — Automático con GitHub Actions

Cada vez que crees un **tag** `vX.Y.Z` en GitHub, el workflow `.github/workflows/release.yml` compila en Windows y publica la Release automáticamente:

```bash
git tag v0.2.0
git push origin v0.2.0
```

La versión del `package.json` debe coincidir con el tag (sin la `v`).

## Datos

- Los datos viven en `%APPDATA%\habitia\data\habitia.db` (SQLite).
- Los backups automáticos se guardan en `Documentos\HABITIA\respaldos`.

## Repositorios

- Código: https://github.com/Riuyi231/habitia