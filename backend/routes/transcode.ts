import { Request, Response, NextFunction, response } from 'express';
import { db } from './database';
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg';
import { NewUsersVideosTranscoded } from './databasetypes'
import { S3Client, DeleteObjectCommand ,GetObjectCommand  } from '@aws-sdk/client-s3';
import { Readable, PassThrough, Stream } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SQSClient, SendMessageCommand,ReceiveMessageCommand, DeleteMessageCommand  } from '@aws-sdk/client-sqs';
const sqsClient = new SQSClient({ region: 'ap-southeast-2' });


var express = require('express');
var router = express.Router();



ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
ffmpeg.setFfprobePath('/usr/bin/ffprobe');
const S3Presigner = require("@aws-sdk/s3-request-presigner");
const S3 = require("@aws-sdk/client-s3");
const authorization = require("../middleware/auth.ts");



const s3Client = new S3Client({ region: 'ap-southeast-2' });



async function getParameterValue(parameter_name: string): Promise<string | undefined> {
  const ssmClient = new SSMClient({ region: 'ap-southeast-2' })
  try {
    const response = await ssmClient.send(
      new GetParameterCommand({
        Name: parameter_name,
        WithDecryption: true, 
      })
    )
    return response.Parameter?.Value
  } catch (error) {
    return undefined
  }
}





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

import { promisify } from 'util'; 
import Memcached from 'memcached';
import { ReturnValue } from '@aws-sdk/client-dynamodb';
import { error } from 'console';


interface MemcachedClient extends Memcached {
  aGet: (key: string) => Promise<any>;
  aSet: (key: string, value: any, lifetime: number) => Promise<boolean>; 
}

const memcachedAddress = 'n11431415.km2jzi.cfg.apse2.cache.amazonaws.com:11211';

let memcached: MemcachedClient;
memcached = new Memcached(memcachedAddress) as MemcachedClient;

async function connectToMemcached(): Promise<void> {
  memcached = new Memcached(memcachedAddress) as MemcachedClient;
  memcached.on("failure", (details) => {
     console.log("Memcached server failure: ", details);
  });

  memcached.on("issue", (details) => {
     console.log("Memcached server issue: ", details);
  });

  memcached.on("reconnecting", (details) => {
     console.log("Memcached server reconnecting: ", details);
  });

  memcached.on("reconnect", (details) => {
     console.log("Memcached server reconnected: ", details);
  });

  memcached.on("remove", (details) => {
     console.log("Memcached server removed: ", details);
  });


  memcached.aGet = promisify(memcached.get);
  memcached.aSet = promisify(memcached.set);
}


const retrieveObjectUrl = async (bucketName: string, objectKey: string): Promise<string> => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 10000 });

    return url;
  } catch (err) {
    console.error('Error retrieving presigned URL:', err);
    throw err;
  }
};

// Define the Job interface and jobQueue
interface Job {
  transcodeID: number;
  videoName: string;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  format: string;
  framerate: number;
  username: string;
  userForeignKey: number;
  originalName: string;
  uploadedVideoPath: string;
  s3Key: string;
}

const jobQueue: Job[] = [];

router.post('/video/:video_name', authorization, async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  const username = user?.username;
  const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
  if (checkUserIsExisting.length === 0) {
    return res.status(403).json({ Error: true, Message: 'User does not exist! using jwt without a registered user.' });
  }

  if (!username || typeof username !== 'string' || username.trim() === '') {
    return res.status(404).json({ error: true, message: 'Username failed to be retrieved' });
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

  const usersTranscodedVideos = await db
    .selectFrom('uservideotranscoded')
    .selectAll()
    .where('userid', '=', userTranscodedID)
    .execute();
  if (usersTranscodedVideos.length < 0) {
    transcodeID = 0;
  } else {
    const transodeIDSearchLength = usersTranscodedVideos.length;
    transcodeID = transodeIDSearchLength + 1;
  }

  const videoName = req.params.video_name;
  const { width, height, bitrate, codec, format, framerate } = req.body;

  if (!videoName || !width || !bitrate || !codec || !format || !framerate || !height) {
    return res.status(400).json({ error: true, message: 'You are missing a required parameter...' });
  }

  const videoOriginalNameFind = await db
    .selectFrom('uservideos')
    .select('originalName')
    .where('newFilename', '=', videoName)
    .execute();
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
  const bucketName = await getParameterValue('/n11431415/assignment/bucketName');
  if (!bucketName) {
    throw new Error('Missing required Cognito configuration');
  }
  await connectToMemcached();
  const videoUrl = await retrieveObjectUrl(bucketName, uploadedVideoPath);

  const videoNameExt = videoName.split('.')[0];
  const videoNameWithoutExt = videoName.split('.')[1];
  const videoNameWithTranscode = videoNameExt + '_' + transcodeID;
  const videoNameWithTranscodeWithExt = videoNameWithTranscode + '.' + videoNameWithoutExt;
  const s3Key = `users/${username}/transcoded/${videoNameWithTranscodeWithExt}`;

  const job = {
    transcodeID,
    videoName,
    width,
    height,
    bitrate,
    codec,
    format,
    framerate,
    username,
    userForeignKey,
    originalName,
    uploadedVideoPath,
    s3Key,
  };


  const queueUrl = 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11431415-assignment'; 

  const params = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(job),
  };

  try {
    await sqsClient.send(new SendMessageCommand(params));
    res.status(200).json({ message: 'Transcoding job queued', transcodeID });
  } catch (error) {
    console.error('Error sending message to SQS:', error);
    res.status(500).json({ error: true, message: 'Failed to queue transcoding job.' });
  }
});

async function processMessages() {
  const queueUrl = 'https://sqs.ap-southeast-2.amazonaws.com/901444280953/n11431415-assignment'; // Replace with your queue URL

  const params = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1, 
    WaitTimeSeconds: 20,    
  };

  try {
    const data = await sqsClient.send(new ReceiveMessageCommand(params));

    if (data.Messages && data.Messages.length > 0) {
      for (const message of data.Messages) {
        if(!message.Body){
          return {error : true}
        }
        const job = JSON.parse(message.Body);

   
        await processJob(job);

     
        await sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          })
        );
      }
    }
  } catch (error) {
    console.error('Error receiving or processing messages from SQS:', error);
  } finally {

    processMessages();
  }
}
async function processJob(job: Job) {
  const {
    transcodeID,
    videoName,
    width,
    height,
    bitrate,
    codec,
    format,
    framerate,
    username,
    userForeignKey,
    originalName,
    uploadedVideoPath,
    s3Key,
  } = job;

  try {
    const bucketName = await getParameterValue('/n11431415/assignment/bucketName');
    if (!bucketName) {
      throw new Error('Bucket name not found.');
    }
    const videoUrl = await retrieveObjectUrl(bucketName, uploadedVideoPath);

    const resolution = `${width}x${height}`;

    const command = ffmpeg(videoUrl)
      .inputOptions(['-loglevel', 'debug'])
      .size(resolution)
      .videoBitrate(bitrate)
      .videoCodec(codec)
      .fps(framerate)
      .format('mp4')
      .outputOptions(['-movflags', 'frag_keyframe+empty_moov+default_base_moof']);

    const ffmpegStream = new PassThrough();
    let ffmpegProc: any;
    command
      .output(ffmpegStream)
      .on('start', (commandLine) => {
        console.log(commandLine);
        const ffmpegCommand = command as unknown as {
          ffmpegProc: { pid: number };
        };

        if (ffmpegCommand.ffmpegProc) {
          const pid = ffmpegCommand.ffmpegProc.pid;
          ffmpegProc = command as unknown as { ffmpegProc: { pid: number } };
        }
      })
      .on('progress', async (progress) => {
        const percent = typeof progress.percent === 'number' ? parseFloat(progress.percent.toFixed(2)) : 0;

        try {
          await memcached.aSet(`transcode_${transcodeID}`, percent, 120);
        } catch (err) {
          await connectToMemcached();
          console.error('Error updating cache:', err);
        }
      })
      .on('end', async () => {
        try {
          await memcached.aSet(`transcode_${transcodeID}`, 100, 120);
        } catch (err) {
          await connectToMemcached();
          console.error('Error updating cache:', err);
        }
      })
      .on('error', () => {
        if (ffmpegProc) {
          ffmpegProc.ffmpegProc.kill('SIGKILL');
        }
      })
      .run();

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: s3Key,
        Body: ffmpegStream,
        ContentType: 'video/mp4',
      },
    });

    upload.on('httpUploadProgress', (progress) => {});

    await upload.done();

    const transcodeUrl = await retrieveObjectUrl(bucketName, s3Key);

    try {
      const metadataFromTranscode = await getVideoMetadata(transcodeUrl);
      const metadata: NewUsersVideosTranscoded = {
        userid: userForeignKey,
        originalName: originalName,
        mimeType: format,
        size: metadataFromTranscode.size,
        path: s3Key,
        newFilename: `${videoName}_${transcodeID}.${videoName.split('.').pop()}`,
        duration: metadataFromTranscode.duration,
        bit_rate: bitrate,
        codec: metadataFromTranscode.codec,
        width: metadataFromTranscode.width,
        height: metadataFromTranscode.height,
        userTranscodeID: transcodeID,
      };
      await db.insertInto('uservideotranscoded').values(metadata).executeTakeFirst();
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  } catch (error) {
    console.error(`Error processing job ${transcodeID}:`, error);
   
  }
}



router.post('/poll/:transcode_id', authorization, async (req: Request, res: Response) => {
  const transcodeID = parseInt(req.params.transcode_id, 10);
  const { videoNameWithTranscodeWithExt} = req.body;

  if (isNaN(transcodeID) || !Number.isInteger(transcodeID) || transcodeID <= 0) {
    return res.status(400).json({ error: true, message: 'Invalid transcode ID.' });
  }
  connectToMemcached();
  try {
    

    let progress = await memcached.aGet(`transcode_${transcodeID}`);
    if (!progress) {
      return res.status(404).json({ error: true, message: 'Transcode ID not found.' });
    }

    let status = "started";
    if(progress > 99){
      progress = 100;
      status = 'finished';
    }   

    return res.status(200).json({
      status: status,
      progress: progress,
    });
  } catch (err) {
    console.error('Error retrieving cache:', err);
    return res.status(500).json({ error: true, message: 'Failed to retrieve progress.' });
  }
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
        const bucketName = await getParameterValue('/n11431415/assignment/bucketName');
        if (!bucketName) {
          throw new Error('Missing required Cognito configuration');
        }
        const presignedURL = await streamObject(bucketName, uploadedVideoPath);
        
        const streamUrl : SteamData = {
           url: presignedURL
        };
        
        return res.status(200).json({ error: false, streamUrl });
       
    } catch (error) {
        next(error);
    }
});


export default router;


export { processMessages };