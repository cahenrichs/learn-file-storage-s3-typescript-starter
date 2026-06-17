import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError, UserNotAuthenticatedError } from "./errors";
import { createTextSpanFromBounds } from "typescript";
import { mediaTypeToExt, getAssetDiskPath, getAssetURL } from "./assets";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here

  const formData = await req.formData();
  const file = formData.get("thumbnail")
  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbanil file misiing")
  }

  const MAX_UPLOAD_SIZE = 10 << 20;
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File is too large")
  }


 const mediaType = file.type;
 if (mediaType !== "image/jpeg" && mediaType !== "image/png") {
    throw new BadRequestError("Invalid file type. Only JPEG or PNG allowed.");
 }
 const ext = mediaTypeToExt(mediaType)

 const filename = videoId + ext

 const path = getAssetDiskPath(cfg, filename)
 await Bun.write(path, file)
 const url = getAssetURL(cfg, filename)

  const videoMetadata = getVideo(cfg.db, videoId)
  if (!videoMetadata) {
    throw new NotFoundError("Video not found")
  }
  if (userID !== videoMetadata?.userID) {
    throw new UserForbiddenError("Not the video owner")
  }

  videoMetadata.thumbnailURL = url
  
  const updatedProfile = await updateVideo(cfg.db, videoMetadata)

  return respondWithJSON(200, videoMetadata);
}
