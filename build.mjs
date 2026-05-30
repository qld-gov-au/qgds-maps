import { mkdir, rm, cp, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { build as esbuild } from "esbuild";
import * as sass from "sass";

const mode = process.argv[2] || "dev";
const root = process.cwd();
const entryFile = resolve(root, "src", "index.js");
const styleFile = resolve(root, "src", "index.scss");
const distDir = resolve(root, "dist");
const bundleName = "qgds-ext-leaflet.min";
const outFile = resolve(distDir, `${bundleName}.js`);
const outStyleFile = resolve(distDir, `${bundleName}.css`);
const isProd = mode === "prod";
const requiredEnvVars = [
  "QGDS_EXT_LEAFLET_IMAGE_BASE_URL",
  "QGDS_EXT_LEAFLET_IMAGE_DATA_PATH",
  "QGDS_EXT_LEAFLET_GEOJSON_PATH",
];

function loadEnvFile() {
  const envFile = resolve(root, ".env");

  if (!existsSync(envFile)) {
    return;
  }

  const content = readFileSync(envFile, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmedLine.split("=");
    const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");

    const envKey = key.trim();

    if (!process.env[envKey] && value) {
      process.env[envKey] = value;
    }
  }
}

loadEnvFile();

function requireEnvVars() {
  const missingVars = requiredEnvVars.filter((name) => !process.env[name]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}. ` +
      "Copy .env.example to .env or set the client config in the workflow matrix."
    );
  }
}

function prefixedLeafletSelector(selector) {
  const cleanSelector = selector.trim();

  if (!cleanSelector || cleanSelector.startsWith(".qgds-ext-leaflet")) {
    return cleanSelector;
  }

  if (cleanSelector.startsWith(".leaflet-")) {
    return `.qgds-ext-leaflet${cleanSelector}, .qgds-ext-leaflet ${cleanSelector}`;
  }

  if (cleanSelector.startsWith(".leaflet-container")) {
    return `.qgds-ext-leaflet${cleanSelector}, .qgds-ext-leaflet ${cleanSelector}`;
  }

  return `.qgds-ext-leaflet ${cleanSelector}`;
}

function prefixCssSelectors(css) {
  let index = 0;

  function readUntil(char) {
    const start = index;
    while (index < css.length && css[index] !== char) index += 1;
    return css.slice(start, index);
  }

  function prefixBlock() {
    let output = "";

    while (index < css.length) {
      if (/\s/.test(css[index])) {
        output += css[index];
        index += 1;
        continue;
      }

      if (css[index] === "}") {
        index += 1;
        return output;
      }

      const selector = readUntil("{").trim();

      if (index >= css.length) {
        return output + selector;
      }

      index += 1;

      if (selector.startsWith("@")) {
        output += `${selector} {${prefixBlock()}}`;
        continue;
      }

      const body = readUntil("}");
      index += 1;
      const prefixedSelector = selector
        .split(",")
        .map(prefixedLeafletSelector)
        .join(",\n");

      output += `${prefixedSelector} {${body}}`;
    }

    return output;
  }

  return prefixBlock();
}

function rewriteLeafletAssetPaths(css) {
  return css.replace(/url\((["']?)images\/(.+?)\1\)/g, 'url("./assets/leaflet/$2")');
}

async function buildStyles() {
  const leafletCss = (await readFile(resolve(root, "node_modules", "leaflet", "dist", "leaflet.css"), "utf8"))
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const compiled = sass.compile(styleFile, {
    loadPaths: [resolve(root, "src")],
    sourceMap: !isProd,
    sourceMapIncludeSources: true,
    style: isProd ? "compressed" : "expanded",
  });

  const css = [
    "/* node_modules/leaflet/dist/leaflet.css */",
    rewriteLeafletAssetPaths(prefixCssSelectors(leafletCss)),
    "/* src/index.scss */",
    compiled.css,
  ].join("\n\n");

  await writeFile(
    outStyleFile,
    isProd ? css : `${css}\n/*# sourceMappingURL=${bundleName}.css.map */\n`,
    "utf8"
  );

  if (!isProd && compiled.sourceMap) {
    await writeFile(resolve(distDir, `${bundleName}.css.map`), JSON.stringify(compiled.sourceMap), "utf8");
  }
}

async function build() {
  requireEnvVars();

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await esbuild({
    entryPoints: [entryFile],
    outfile: outFile,
    bundle: true,
    format: "iife",
    globalName: "QldLgaMaps",
    platform: "browser",
    target: ["es2020"],
    minify: isProd,
    sourcemap: isProd ? false : "linked",
    define: {
      "process.env.NODE_ENV": JSON.stringify(isProd ? "production" : "development"),
      "process.env.QGDS_EXT_LEAFLET_IMAGE_BASE_URL": JSON.stringify(process.env.QGDS_EXT_LEAFLET_IMAGE_BASE_URL),
      "process.env.QGDS_EXT_LEAFLET_IMAGE_DATA_PATH": JSON.stringify(process.env.QGDS_EXT_LEAFLET_IMAGE_DATA_PATH),
      "process.env.QGDS_EXT_LEAFLET_GEOJSON_PATH": JSON.stringify(process.env.QGDS_EXT_LEAFLET_GEOJSON_PATH)
    },
    loader: {
      ".png": "file",
      ".gif": "file",
      ".svg": "file",
    },
    assetNames: "assets/leaflet/[name]-[hash]"
  });

  await buildStyles();

  await cp(resolve(root, "src", "data"), resolve(distDir, "data"), { recursive: true });
  await cp(
    resolve(root, "node_modules", "leaflet", "dist", "images"),
    resolve(distDir, "assets", "leaflet"),
    { recursive: true }
  );

  await writeFile(
    resolve(distDir, "build-meta.json"),
    JSON.stringify(
      {
        mode,
        builtAt: new Date().toISOString(),
        entryFile: "src/index.js",
        outputFile: `dist/${bundleName}.js`,
        styleFile: "src/index.scss",
        outputStyleFile: `dist/${bundleName}.css`,
        imageBaseUrl: process.env.QGDS_EXT_LEAFLET_IMAGE_BASE_URL,
        imageDataPath: process.env.QGDS_EXT_LEAFLET_IMAGE_DATA_PATH,
        geojsonPath: process.env.QGDS_EXT_LEAFLET_GEOJSON_PATH
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`Build complete (${mode}). Output: ${distDir}`);
}

build().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
