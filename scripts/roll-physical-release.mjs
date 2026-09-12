import { copyFile, readFile, writeFile } from "node:fs/promises";
import { posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_IMPORT = /((?:from|import)\s*["'])(\.[^"']+\.js)(["'])/g;

export function localModuleSpecifiers(source) {
  return [...source.matchAll(LOCAL_IMPORT)].map(match => match[2]);
}

export function normalizeRelativeModule(importer, specifier) {
  return posix.normalize(posix.join(posix.dirname(importer), specifier));
}

export function rewriteLocalImports(source, importer, targetOf, visited) {
  return source.replace(LOCAL_IMPORT, (full, open, specifier, close) => {
    const dependency = normalizeRelativeModule(importer, specifier);
    if (!visited.has(dependency)) return full;
    let relative = posix.relative(posix.dirname(targetOf(importer)), targetOf(dependency));
    if (!relative.startsWith(".")) relative = "./" + relative;
    return open + relative + close;
  });
}

export async function rollPhysicalRelease({ rootDir, sourceEntry, sourceCss, suffix }) {
  const root = resolve(rootDir);
  const safePath = path => {
    const absolute = resolve(root, path);
    if (absolute !== root && !absolute.startsWith(root + sep)) throw new Error("release path escaped rootDir: " + path);
    return absolute;
  };
  const visited = new Set();
  const queue = [sourceEntry];
  const targetOf = path => path.replace(/\.js$/, "-" + suffix + ".js");
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    const source = await readFile(safePath(path), "utf8");
    for (const specifier of localModuleSpecifiers(source)) queue.push(normalizeRelativeModule(path, specifier));
  }
  for (const path of visited) {
    const source = await readFile(safePath(path), "utf8");
    await writeFile(safePath(targetOf(path)), rewriteLocalImports(source, path, targetOf, visited));
  }
  const targetCss = sourceCss.replace(/\.css$/, "-" + suffix + ".css");
  await copyFile(safePath(sourceCss), safePath(targetCss));
  return { sourceEntry, targetEntry: targetOf(sourceEntry), sourceCss, targetCss, files: [...visited].map(targetOf) };
}

function cliValue(name) {
  const index = process.argv.indexOf("--" + name);
  if (index < 0 || !process.argv[index + 1]) throw new Error("missing --" + name);
  return process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await rollPhysicalRelease({ rootDir: process.cwd(), sourceEntry: cliValue("entry"), sourceCss: cliValue("css"), suffix: cliValue("suffix") });
  console.log("modules=" + result.files.length + " target=" + result.targetEntry);
}
