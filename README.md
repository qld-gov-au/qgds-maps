# QGDS maps

Embeddable Leaflet maps for Queensland Government Design System websites.
This is not production ready and is an active prototype subject to change at any moment.

## Develop

```sh
npm install
cp .env.example .env
npm run dev
```

### Environment variables (dev setup)

.env:
```
QGDS_EXT_LEAFLET_IMAGE_BASE_URL=/data/assets/
QGDS_EXT_LEAFLET_IMAGE_DATA_PATH=/data/qsbc_lga_images.json
QGDS_EXT_LEAFLET_GEOJSON_PATH=/data/qsbc_interactive_map.json
```

All three values are required for local builds.

Local server: `http://localhost:4200`

## Embed

```html
<link rel="stylesheet" href="./qgds-ext-leaflet.min.css">
<div id="map" class="qgds-ext-leaflet"></div>
<script src="./qgds-ext-leaflet.min.js"></script>
```

## Build

```sh
npm run build:dev
npm run build:prod
npm test
```

`build:dev` keeps JS/CSS readable and emits source maps. `build:prod` minifies JS/CSS and omits source maps.

## Workflows

GitHub Actions builds `dist/`, runs tests, then publishes the built assets to release branches.

Clients are configured in `.github/workflows/build.yml` under `matrix.client`. Each client sets:

- `id`
- `image_base_url`
- `image_data_path`
- `geojson_path`

These are the same as the local environment variables in dev setup.

The workflow builds once per client. With 10 clients, one workflow run creates 10 client builds and publishes 10 release branches.

Release branches are client-specific:

- `development` builds publish to `release-dev-<client>`
- `uat` builds publish to `release-uat-<client>`
- `main` builds publish to `release-production-<client>`

Example: `qsbc` publishes to `release-dev-qsbc`, `release-uat-qsbc`, and `release-production-qsbc`.

Current behavior: pull requests into `development`, `uat`, or `main` also publish release branches for non-fork PRs. Change the publish step to `push` only if releases should happen only after merge.

## Clients

The map code is shared. Client-specific content lives in data files and hosted image folders. To add another client, publish its data/images, then add a client entry to the workflow matrix.
