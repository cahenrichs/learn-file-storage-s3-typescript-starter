import { existsSync, mkdirSync } from "fs";

import type { ApiConfig } from "../config";
import path from "path";
import { randomBytes } from "crypto";

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}

export function mediaTypeToExt(mediaType: string) {
  const split = mediaType.split("/")
  if (split.length !== 2) {
    return ".bin"
  }
  return `.${split[1]}`
}

export function getAssetDiskPath(cfg: ApiConfig, assetPath: string) {
  return path.join(
    cfg.assetsRoot,
    assetPath,
  )
}

export function getAssetURL(cfg: ApiConfig, assetPath: string) {
  const newUrl = `http://localhost:${cfg.port}/assets/${assetPath}`
  return newUrl
}

export function getAssetPath(mediaType: string) {
  const type = mediaTypeToExt(mediaType)
  const bytes = randomBytes(32);
  const randomName = bytes.toString("base64url")
  return randomName + type
}