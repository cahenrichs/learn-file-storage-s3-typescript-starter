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

 await Bun.write(tempPath, file)

 const aspectRatio = await getVideoaspectRatio(tempPath)

 const videoMetadata = getVideo(cfg.db, videoId)
   if (!videoMetadata) {
     throw new NotFoundError("Video not found")
   }
   if (userID !== videoMetadata?.userID) {
     throw new UserForbiddenError("Not the video owner")
   }

  const key = `${aspectRatio}/${videoId}.mp4`

  const s3File = cfg.s3Client.file(key)
  await s3File.write(Bun.file(tempPath), {type: "video/mp4" })

  const newVidUrl = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`
  videoMetadata.videoURL = newVidUrl
  updateVideo(cfg.db, videoMetadata)

  return respondWithJSON(200, null);
}

export async function getVideoaspectRatio(filePath: string) {
  const proc = Bun.spawn([
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height","-of",
    "json",
    filePath
  ], {
  stdout: "pipe",
  stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`ffporbe error: ${stderr}`);
  }

  const data = JSON.parse(stdout)
  const { width, height } = data.streams[0];
  if(Math.floor(width / height * 9) === 16) {
    return "landscape"
  } else if (Math.floor(width / height * 16) === 9) {
    return "portrait";
  } else {
    return "other"
  }
}
