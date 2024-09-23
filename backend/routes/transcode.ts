import { Request, Response, NextFunction, response } from 'express';
import { db } from './database';
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg';
import { NewUsersVideosTranscoded } from './databasetypes'
import { S3Client, DeleteObjectCommand ,GetObjectCommand  } from '@aws-sdk/client-s3';
import { Readable, PassThrough, Stream } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';

var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath); 
const S3Presigner = require("@aws-sdk/s3-request-presigner");
const S3 = require("@aws-sdk/client-s3");
const bucketName = 'n11431415-assignment-two';
const authorization = require("../middleware/auth.ts");

const s3Client = new S3Client({ region: 'ap-southeast-2' });

interface TranscodingProgress {
    status: string;
    progress: number;
}

interface FFmpegProcessInfo {
    process: any; 
    pid: number;
  }

const transcodingProgress: Record<string, TranscodingProgress> = {};
const ffmpegProcesses: Record<string, FFmpegProcessInfo> = {};
const s3KeysByTranscodeID: Record<number, string> = {};



const retrieveObjectUrl = async (bucketName: string, objectKey: string): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });

    const url = await S3Presigner.getSignedUrl(s3Client, command, { expiresIn: 3600 }); 
    return url;
  } catch (err) {
    throw err;
  }
};




interface VideoMetadata {
  size: number; 
  duration: number; 
  width: number; 
  height: number; 
  codec: string; 
}


const getVideoMetadata = async (videoUrl: string): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoUrl)
      .ffprobe((err, data) => {
        if (err) {
          reject(err);
        } else {
          const metadata: VideoMetadata = {
            size: data.format.size ?? 0,
            duration: data.format.duration ?? 0,
            width: data.streams[0]?.width ?? 0,
            height: data.streams[0]?.height ?? 0,
            codec: data.streams[0]?.codec_name ?? 'unknown',
          };
          resolve(metadata);
        }
      });
  });
};




router.post('/video/:video_name', authorization,async (req: Request, res: Response, next: NextFunction) => {
  
  const user = (req as any).user;
  const username = user?.username;
  const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
  if (checkUserIsExisting.length === 0) {
      return res.status(403).json({ Error: true, Message: 'User does not exist! using jwt without a registered user.' });
  }

  if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(404).json({ error: true, message: "Username failed to be retrieved" });
  }

  const userForeignKeyFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
  if (userForeignKeyFind.length < 0) {
      return res.status(404).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
  }
  const userForeignKey = userForeignKeyFind[0].id;
  
  const userTranscodedIDFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
  if (userTranscodedIDFind.length < 0) {
      return res.status(404).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
  }
  const userTranscodedID = userTranscodedIDFind[0].id;


  let transcodeID = 0;



  const usersTranscodedVideos = await db.selectFrom("uservideotranscoded").selectAll().where('userid', '=', userTranscodedID).execute();
  if (usersTranscodedVideos.length < 0) {
      transcodeID = 0;
  }
  else {
      const transodeIDSearchLength = usersTranscodedVideos.length
      transcodeID = transodeIDSearchLength + 1;
  }

 
  res.status(200).json({ message: 'Transcoding started', transcodeID });

    const videoName = req.params.video_name;
    const { width, height, bitrate, codec, format, framerate } = req.body;

    if (!videoName || !width || !bitrate || !codec || !format || !framerate || !height) {
      return res.status(400).json({ error: true, message: 'You are missing a required parameter...' });
    }

    const videoOriginalNameFind = await db.selectFrom("uservideos").select("originalName").where("newFilename", '=', videoName).execute();
    const originalName = videoOriginalNameFind[0].originalName;

    const userVideoPathQuery = await db
      .selectFrom('uservideos')
      .select('path')
      .where('newFilename', '=', videoName)
      .execute();

    if (userVideoPathQuery.length === 0) {
      return res.status(404).json({ error: true, message: 'No Video has been uploaded matching that name.' });
    }

    const uploadedVideoPath = userVideoPathQuery[0].path;

    const videoUrl = await retrieveObjectUrl(bucketName, uploadedVideoPath);
   
    const resolution = `${width}x${height}`;

    const command = ffmpeg(videoUrl)
  .inputOptions(['-loglevel', 'debug'])
  .size(resolution)
  .videoBitrate(bitrate)
  .videoCodec(codec)
  .fps(framerate)
  .format('mp4')
  .outputOptions([
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
  ]);


const ffmpegStream = new PassThrough();
transcodingProgress[transcodeID] = { status: 'started', progress: 0 };

command
  .output(ffmpegStream)
  .on('start', (commandLine) => {
    const ffmpegCommand = command as unknown as {
      ffmpegProc: { pid: number };
    };

    if (ffmpegCommand.ffmpegProc) {
      const pid = ffmpegCommand.ffmpegProc.pid;
      ffmpegProcesses[transcodeID] = {
        process: ffmpegCommand.ffmpegProc,
        pid: pid,
      };
    }
  })
  .on('progress', (progress) => {
    transcodingProgress[transcodeID].progress = progress.percent || 0;
  })
  .on('end', () => {
    transcodingProgress[transcodeID].status = 'finished';
    transcodingProgress[transcodeID].progress = 100;
  })
  .on('error', (err) => {
    if (ffmpegProcesses[transcodeID]) {
      ffmpegProcesses[transcodeID].process.kill('SIGKILL');
      delete ffmpegProcesses[transcodeID];
  }
  delete transcodingProgress[transcodeID];
  })
  .run();

  const videoNameExt = videoName.split(".")[0];
  const videoNameWithoutExt = videoName.split(".")[1];
  const videoNameWithTranscode = videoNameExt + "_" + transcodeID;
  const videoNameWithTranscodeWithExt = videoNameWithTranscode+ "." +videoNameWithoutExt;

  const s3Key = `users/${username}/transcoded/${videoNameWithTranscodeWithExt}`;
  
  


const upload = new Upload({
  client: s3Client,
  params: {
    Bucket: bucketName,
    Key: s3Key,
    Body: ffmpegStream,
    ContentType: 'video/mp4',
  },
});

upload.on('httpUploadProgress', (progress) => {
});


await upload.done();
s3KeysByTranscodeID[transcodeID] = s3Key;

const transcodeUrl = await retrieveObjectUrl(bucketName, s3Key);


(async () => {
  try {
    const metadataFromTranscode = await getVideoMetadata(transcodeUrl);
    const metadata: NewUsersVideosTranscoded = {
      userid: userForeignKey,
      originalName: originalName,
      mimeType: format,
      size: metadataFromTranscode.size,
      path: s3Key,
      newFilename: videoNameWithTranscodeWithExt,
      duration: metadataFromTranscode.duration,
      bit_rate: bitrate,
      codec: metadataFromTranscode.codec,
      width: metadataFromTranscode.width,
      height: metadataFromTranscode.height,
      userTranscodeID: transcodeID,
    };
    db.insertInto('uservideotranscoded').values(metadata).executeTakeFirst();
  } catch (error) {
  }
})();


 
});



router.get('/poll/:transcode_id', authorization, async (req: Request, res: Response, next: NextFunction) => {
    const transcodeID = parseInt(req.params.transcode_id, 10);

    if (isNaN(transcodeID) || !Number.isInteger(transcodeID) || transcodeID <= 0) {
        return res.status(400).json({ error: true, message: "Invalid transcode ID." });
    }

    const progressInfo = transcodingProgress[transcodeID];
    if (!progressInfo) {
        return res.status(404).json({ error: true, message: 'Transcode ID not found.' });
    }

    return res.status(200).json({
        status: progressInfo.status,
        progress: progressInfo.progress,
    });
});

const streamObject = async (bucketName: string, objectKey: string) => {
  const s3Client = new S3Client({ region: 'ap-southeast-2' });

  try {
      const command = new S3.GetObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
      });

      const presignedURL = await S3Presigner.getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return presignedURL;
    

  } catch (err) {
      throw err; 
  }
};




interface SteamData {
  url: string; 
}


router.get('/stream/:videoname', authorization, async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const username = user?.username;
  
    try {
        const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
        if (checkUserIsExisting.length === 0) {
            return res.status(403).json({ Error: true, Message: 'User does not exist! Using JWT without a registered user.' });
        }

        if (!username || typeof username !== 'string' || username.trim() === '') {
            return res.status(404).json({ error: true, message: "Username failed to be retrieved" });
        }
        const videoName = req.params.videoname;
        const userVideoPathQuery = await db.selectFrom('uservideotranscoded').select('path').where('newFilename', '=', videoName).execute();
        if (userVideoPathQuery.length === 0) {
        return res.status(404).json({ error: true, message: "No Video has been uploaded matching that name." });
        }
        const uploadedVideoPath = userVideoPathQuery[0].path;
        const presignedURL = await streamObject(bucketName, uploadedVideoPath);
        
        const streamUrl : SteamData = {
           url: presignedURL
        };
        
        return res.status(200).json({ error: false, streamUrl });
       
    } catch (error) {
        next(error);
    }
});

const deleteObject = async (bucketName: string, objectKey: string) => {
  const s3Client = new S3Client({ region: 'ap-southeast-2' });

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    const response = await s3Client.send(command);
    return response;
  } catch (err) {
    throw err;
  }
};

router.get('/kill/:transcode_id', authorization, async (req: Request, res: Response) => {
  const transcodeID = parseInt(req.params.transcode_id, 10);

  if (isNaN(transcodeID) || !Number.isInteger(transcodeID) || transcodeID <= 0) {
    return res.status(400).json({ error: true, message: 'Invalid transcode ID.' });
  }

  const processInfo = ffmpegProcesses[transcodeID];
  if (!processInfo) {
    return res.status(404).json({ error: true, message: 'FFmpeg process not found.' });
  }

 

  try {
   // await deleteObject(bucketName, s3Key);

 
    processInfo.process.kill('SIGKILL');
    delete ffmpegProcesses[transcodeID];
    delete transcodingProgress[transcodeID];
    delete s3KeysByTranscodeID[transcodeID];

    res.status(200).json({ message: 'FFmpeg process terminated successfully.' });
  } catch (error) {
    res.status(500).json({ error: true, message: 'Failed to terminate FFmpeg process or delete S3 object.' });
  }
});




module.exports = router;
