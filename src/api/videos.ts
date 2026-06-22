import { respondWithJSON } from "./json";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { type ApiConfig } from "../config";
import { pathToFileURL, S3Client, type BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo } from "../db/videos";
import path from "path";
import { updateVideo } from "../db/videos";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
   const { videoId } = req.params as { videoId?: string };
    if (!videoId) {
      throw new BadRequestError("Invalid video ID");
    }
  
   const token = getBearerToken(req.headers);
   const userID = validateJWT(token, cfg.jwtSecret);

   const formData = await req.formData();
   const file = formData.get("video")
    if (!(file instanceof File)) {
      throw new BadRequestError("Video file misiing")
    }
  
   const MAX_UPLOAD_SIZE = 1 << 30;
    if (file.size > MAX_UPLOAD_SIZE) {
      throw new BadRequestError("File is too large")
    }

   const mediaType = file.type;
    if (mediaType !== "video/mp4") {
      throw new BadRequestError("Invalid file type. Only video or mp4 allowed.");
 }

 const tempPath = path.join("/tmp", `${videoId}.mp4`)

 const videoMetadata = getVideo(cfg.db, videoId)
   if (!videoMetadata) {
     throw new NotFoundError("Video not found")
   }
   if (userID !== videoMetadata?.userID) {
     throw new UserForbiddenError("Not the video owner")
   }

  await Bun.write(tempPath, file)

  const key = `${videoId}.mp4`

  const s3File = cfg.s3Client.file(key)
  await s3File.write(Bun.file(tempPath), {type: "video/mp4" })

  const newVidUrl = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`
  videoMetadata.videoURL = newVidUrl
  updateVideo(cfg.db, videoMetadata)

  return respondWithJSON(200, null);
}
