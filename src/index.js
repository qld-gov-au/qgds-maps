import L from 'leaflet';

const COLOR_ACTIVE   = '#FF671F';
const COLOR_INACTIVE = '#002A3A';
const WRAPPER_CLASS  = 'qgds-ext-leaflet';
const IMAGE_BASE_URL = process.env.QGDS_EXT_LEAFLET_IMAGE_BASE_URL;
const IMAGE_DATA_PATH = process.env.QGDS_EXT_LEAFLET_IMAGE_DATA_PATH;
const GEOJSON_PATH = process.env.QGDS_EXT_LEAFLET_GEOJSON_PATH;
const SCRIPT_ASSET_BASE = typeof document !== 'undefined' && document.currentScript?.src
  ? new URL('.', document.currentScript.src)
  : null;

function getAssetBase() {
  return SCRIPT_ASSET_BASE ?? new URL('./', window.location.href);
}

function getImageBase(assetBase) {
  return new URL(IMAGE_BASE_URL, window.location.href);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function styleFor(hasLink) {
  return {
    color:       hasLink ? COLOR_ACTIVE : COLOR_INACTIVE,
    fillColor:   hasLink ? COLOR_ACTIVE : COLOR_INACTIVE,
    weight:       2,
    opacity:      hasLink ? 1.0  : 0.40,
    fillOpacity:  hasLink ? 0.30 : 0.10,
  };
}

export function getStatus() {
  return 'qld-lga-maps ready';
}

async function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) {
    console.error('Map container not found');
    return;
  }

  mapEl.classList.add(WRAPPER_CLASS);
  const assetBase = getAssetBase();
  const imageBase = getImageBase(assetBase);

  const map = L.map(mapEl, {
    center: [-19.639138, 146.032515],
    zoom: 6,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);

  const [imageData, geoData] = await Promise.all([
    fetch(new URL(IMAGE_DATA_PATH, assetBase)).then(r => r.json()),
    fetch(new URL(GEOJSON_PATH, assetBase)).then(r => r.json()),
  ]);

  let activePopup = null;

  L.geoJSON(geoData, {
    filter: f => f.geometry.type === 'MultiPolygon',

    style: feature => {
      const name    = feature.properties.lga;
      const hasLink = !!(imageData[name]?.link);
      return styleFor(hasLink);
    },

    onEachFeature(feature, layer) {
      const name    = feature.properties.lga || 'Unknown Region';
      const meta    = imageData[name];
      const link    = meta?.link     ?? '';
      const imgFile = meta?.filename ?? null;
      const hasLink = !!link;
      const safeName = escHtml(name);
      const safeLink = escHtml(link);
      const safeImg  = imgFile ? escHtml(imgFile) : null;

      layer.on('mouseover', e => {
        if (activePopup) return;
        const label = hasLink
          ? `<a href="${safeLink}" target="_blank" class="qsbc-location-title">${safeName}</a>`
          : `<span class="qsbc-location-title-no-link">${safeName}</span>`;
        layer.bindTooltip(label, {
          sticky:    true,
          direction: 'top',
          offset:    [0, -10],
          className: 'lga-tooltip-hover',
        }).openTooltip(e.latlng);
      });

      layer.on('mouseout', () => {
        layer.closeTooltip();
        layer.unbindTooltip();
      });

      layer.on('click', e => {
        if (activePopup) { activePopup.remove(); activePopup = null; }
        layer.closeTooltip();
        layer.unbindTooltip();

        let html = `<div class="image-wrapper info-window-content" style="text-align:center;">`;
        html += hasLink
          ? `<a href="${safeLink}" class="qsbc-location-title" target="_blank"><span style="font-size:18px;font-weight:400;">${safeName}</span></a>`
          : `<span class="qsbc-location-title-no-link" style="font-size:18px;font-weight:400;">${safeName}</span>`;
        if (safeImg) {
          const imgSrc = escHtml(new URL(safeImg, imageBase).toString());
          const img = `<img src="${imgSrc}" alt="${safeName}" class="qgds-ext-leaflet-popup-image">`;
          html += hasLink ? `<a href="${safeLink}" target="_blank">${img}</a>` : img;
        }
        html += `</div>`;

        activePopup = L.popup({ className: 'lga-popup-image' })
          .setLatLng(e.latlng)
          .setContent(html)
          .openOn(map);

        map.once('popupclose', () => { activePopup = null; });
      });
    },
  }).addTo(map);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () =>
      initMap().catch(err => console.error('Map init failed:', err))
    );
  } else {
    initMap().catch(err => console.error('Map init failed:', err));
  }
}
