import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('smoke: JS bundle exists', () => {
  assert.ok(existsSync('./dist/qgds-ext-leaflet.min.js'), 'dist/qgds-ext-leaflet.min.js should exist after build');
});

test('smoke: CSS bundle exists', () => {
  assert.ok(existsSync('./dist/qgds-ext-leaflet.min.css'), 'dist/qgds-ext-leaflet.min.css should exist after build');
});

test('smoke: build metadata includes data paths', () => {
  const meta = JSON.parse(readFileSync('./dist/build-meta.json', 'utf8'));
  assert.equal(typeof meta.imageDataPath, 'string');
  assert.equal(typeof meta.geojsonPath, 'string');
  assert.ok(meta.imageDataPath.length > 0);
  assert.ok(meta.geojsonPath.length > 0);
});

test('smoke: data is not emitted to dist', () => {
  assert.equal(existsSync('./dist/data'), false, 'data should be loaded from configured URLs');
});

test('smoke: HTML is not emitted to dist', () => {
  assert.equal(existsSync('./dist/index.html'), false, 'dist should only contain embeddable assets');
});

test('smoke: Leaflet CSS is scoped to qgds-ext-leaflet', () => {
  const css = readFileSync('./dist/qgds-ext-leaflet.min.css', 'utf8');
  assert.match(css, /\.qgds-ext-leaflet\.leaflet-container/);
  assert.doesNotMatch(css, /(^|\n)\.leaflet-container/);
});
