import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError, UserNotAuthenticatedError } from "./errors";
import { createTextSpanFromBounds } from "typescript";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

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

  const fileType = file.type

  const arrBuff = await file.arrayBuffer();

  const videoMetadata = getVideo(cfg.db, videoId)
  if (userID !== videoMetadata?.userID) {
    throw new UserForbiddenError("Not the video owner")
  }

  videoThumbnails.set(videoId, {
    data: arrBuff,
    mediaType: fileType
  })

  const thumbnailURL = `http://localhost:${cfg.port}/api/thumbnails/${videoId}`;

  videoMetadata.thumbnailURL = thumbnailURL
  if (!videoMetadata) {
    throw new NotFoundError("Video not found")
  }
  const updatedProfile = await updateVideo(cfg.db, videoMetadata)

  return respondWithJSON(200, videoMetadata);
}
