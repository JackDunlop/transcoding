import { Request, Response, NextFunction } from 'express';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import fileUpload from 'express-fileupload';
import ffmpeg from 'fluent-ffmpeg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { db } from './database';
import { NewUsersVideos } from './databasetypes';
const authorization = require("../middleware/auth.ts");

const router = express.Router();
router.use(fileUpload());

ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
ffmpeg.setFfprobePath('/usr/bin/ffprobe');

const s3Client = new S3Client({ region: 'ap-southeast-2' });

async function getParameterValue(parameter_name: string): Promise<string | undefined> {
  const ssmClient = new SSMClient({ region: 'ap-southeast-2' });
  try {
    const response = await ssmClient.send(
      new GetParameterCommand({
        Name: parameter_name,
        WithDecryption: true,
      })
    );
    return response.Parameter?.Value;
  } catch (error) {
    console.error(`Error fetching parameter ${parameter_name}:`, error);
    return undefined;
  }
}

async function storeObject(
  bucketName: string,
  objectKey: string,
  file: fileUpload.UploadedFile,
  username: string
): Promise<void> {
  if (typeof objectKey !== 'string' || objectKey.trim() === '') {
    throw new Error('Object Key is undefined or empty.');
  }

  try {
    console.log(`Uploading to S3 Bucket: ${bucketName}, Key: ${objectKey}`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: file.data,
        ContentType: file.mimetype,
      })
    );
    console.log(`Successfully uploaded ${objectKey} to ${bucketName}`);
  } catch (err) {
    console.error(`Error uploading the file ${objectKey} to bucket ${bucketName}:`, err);
    throw new Error('Error uploading the file.');
  }
}

router.post('/new', authorization, async (req: Request, res: Response, next: NextFunction) => {

  const bucketName = await getParameterValue('/n11431415/assignment/bucketName');
  const qutUsername = await getParameterValue('/n11431415/assignment/qutUsername');
  const purpose = await getParameterValue('/n11431415/assignment/purpose');

  console.log('SSM Parameters:', { bucketName, qutUsername, purpose });

  if (!bucketName || !qutUsername || !purpose) {
    console.error('Missing required configuration:', { bucketName, qutUsername, purpose });
    return res.status(500).json({ error: true, message: 'Missing required configuration' });
  }

  const files = req.files as {
    [fieldname: string]: fileUpload.UploadedFile | fileUpload.UploadedFile[];
  };
  if (!files || Object.keys(files).length === 0) {
    console.error('No files uploaded in the request');
    return res.status(400).json({ error: true, message: 'No file uploaded' });
  }

  const file = Array.isArray(files['video']) ? files['video'][0] : files['video'];

  if (!file) {
    console.error('No video file found in the uploaded files');
    return res.status(400).json({ error: true, message: 'No video uploaded' });
  }

  const mimeType = file.mimetype;
  if (mimeType.split('/')[0] !== 'video') {
    console.error('Uploaded file is not a video. Mimetype:', mimeType);
    return res.status(400).json({ error: true, message: 'Uploaded file is not a video' });
  }

  const user = (req as any).user;
  const username = user?.username;

  if (!username || typeof username !== 'string' || username.trim() === '') {
    console.error('Username failed to be retrieved from the request:', user);
    return res.status(404).json({ error: true, message: 'Username failed to be retrieved' });
  }

  const sanitizedUsername = username.replace(/[^a-zA-Z0-9-_]/g, '');
  console.log(`Sanitized Username: ${sanitizedUsername}`);

  const checkUserIsExisting = await db
    .selectFrom('users')
    .selectAll()
    .where('username', '=', sanitizedUsername)
    .execute();
  if (checkUserIsExisting.length === 0) {
    console.error('User does not exist in the database:', sanitizedUsername);
    return res.status(404).json({
      error: true,
      message: 'User does not exist! Using JWT without a registered user.',
    });
  }

  const userForeignKeyFind = await db
    .selectFrom('users')
    .select('id')
    .where('username', '=', sanitizedUsername)
    .execute();
  if (userForeignKeyFind.length === 0) {
    console.error('Cannot find user foreign key for username:', sanitizedUsername);
    return res.status(404).json({
      error: true,
      message: 'Cannot find user who uploaded this video.',
    });
  }
  const userForeignKey = userForeignKeyFind[0].id;

  try {
    const uniqueID = uuidv4();
    const ext = path.extname(file.name);
    if (!ext) {
      throw new Error('Uploaded file does not have a valid extension.');
    }
    const newFilename = `${uniqueID}${ext}`;

    const tempVideoPath = path.join('/tmp', newFilename);
    fs.writeFileSync(tempVideoPath, file.data);
    console.log(`Temporary video saved at ${tempVideoPath}`);

    const data = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });

    const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
    if (!videoStream) {
      throw new Error('No video stream found in the file.');
    }
    const bitRate: number = typeof data.format.bit_rate === 'number' ? data.format.bit_rate : 0;
    const objectKey = `users/${sanitizedUsername}/uploaded/${newFilename}`;

   
    console.log(`Constructed objectKey: ${objectKey}`);

    const metadata: NewUsersVideos = {
      userid: userForeignKey,
      originalName: file.name,
      mimeType: file.mimetype,
      size: file.size,
      path: objectKey,
      newFilename: newFilename,
      duration: typeof data.format.duration === 'number' ? data.format.duration : 0,
      bit_rate: bitRate,
      codec: videoStream.codec_name as string,
      width: videoStream.width as number,
      height: videoStream.height as number,
    };

    console.log('Uploading original video to S3:', objectKey);
    await storeObject(bucketName, objectKey, file, sanitizedUsername);

    const segmentDuration = 30; 
    const chunksDir = path.join('/tmp', `${uniqueID}_chunks`); 
    fs.mkdirSync(chunksDir, { recursive: true });
    console.log(`Chunks directory created at ${chunksDir}`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempVideoPath)
        .outputOptions([
          '-c copy',
          '-map 0',
          `-f segment`,
          `-segment_time ${segmentDuration}`,
        ])
        .output(path.join(chunksDir, `${uniqueID}_%03d${ext}`))
        .on('end', () => {
          console.log('Video successfully split into chunks.');
          resolve();
        })
        .on('error', (err: Error) => {
          console.error('Error during video segmentation:', err);
          reject(err);
        })
        .run();
    });

    const chunkFiles = fs.readdirSync(chunksDir);
 

    for (const chunkFile of chunkFiles) {
      const chunkFilePath = path.join(chunksDir, chunkFile);
      const chunkKey = `users/${sanitizedUsername}/uploaded_chunks/${uniqueID}/${chunkFile}`;

      
      if (typeof chunkKey !== 'string' || chunkKey.trim() === '') {
        console.error('Chunk Key is invalid for file:', chunkFile);
        throw new Error('Invalid chunkKey provided.');
      }

    
      const chunkData = fs.readFileSync(chunkFilePath);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: chunkKey,
          Body: chunkData,
          ContentType: file.mimetype,
        })
      );

      const job = {
        transcodeID: uniqueID,
        chunkKey,
        bucketName, 
        username: sanitizedUsername,
        userForeignKey,
        originalName: file.name,
        mimeType: file.mimetype,
      };

    
   
    }

    
    fs.unlinkSync(tempVideoPath);
    fs.rmSync(chunksDir, { recursive: true, force: true });
    console.log('Temporary files cleaned up.');

    
    await db.insertInto('uservideos').values(metadata).executeTakeFirst();
    console.log('Metadata saved to database.');

    return res.status(200).json({
      error: false,
      message: 'Video uploaded and processing started.',
      transcodeID: uniqueID,
    });
  } catch (err) {
    console.error('Error processing upload:', err);
    return res.status(500).json({ error: true, message: 'Error processing file', err: err instanceof Error ? err.message : err });
  }
});

export default router;
