var express = require('express');
import { Request, Response, NextFunction } from 'express';
var router = express.Router();
const authorization = require("../middleware/auth.ts");
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
import { db } from './database'
import fileUpload from 'express-fileupload';
import { NewUsersVideos } from './databasetypes'
import ffmpeg, { FfprobeData } from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath); 
router.use(fileUpload());
import { S3Client, HeadBucketCommand, CreateBucketCommand, PutBucketTaggingCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); 
  return stream;
}

function checkVideoMetadataBuffer(fileBuffer: Buffer): Promise<FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(bufferToStream(fileBuffer)) 
      .ffprobe((err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
  });
}
const S3 = require("@aws-sdk/client-s3");

const bucketName = 'n11431415-assignment-two';
const qutUsername = 'n11431415@qut.edu.au';
const purpose = 'assignment-two';

const createBucket = async (bucketName: string, qutUsername: string, purpose: string): Promise<void> => {
    const s3Client = new S3Client({ region: 'ap-southeast-2' });
  
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      console.log(`Bucket "${bucketName}" already exists.`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
          console.log(`Bucket "${bucketName}" created successfully.`);
  
          await s3Client.send(
            new PutBucketTaggingCommand({
              Bucket: bucketName,
              Tagging: {
                TagSet: [
                  { Key: 'qut-username', Value: qutUsername },
                  { Key: 'purpose', Value: purpose },
                ],
              },
            })
          );
          console.log(`Tags added to bucket "${bucketName}".`);
        } catch (createError) {
          console.error('Error creating the bucket:', createError);
          throw new Error('Error creating the bucket.');
        }
      } else {
        console.error('Error checking bucket existence:', error);
        throw new Error('Error checking bucket existence.');
      }
    }
  };


  
  const storeObject = async ( bucketName: string, file: fileUpload.UploadedFile, username: string): Promise<void> => {
    const s3Client = new S3Client({ region: 'ap-southeast-2' });
  
    try {
      const objectKey = `user/${username}/uploaded/${file.name}`;
      await s3Client.send(
        new S3.PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: file.data, 
          ContentType: file.mimetype, 
        })
      );
  
      console.log(`File "${file.name}" uploaded successfully to "${bucketName}/${objectKey}".`);
    } catch (err) {
      console.error('Error uploading the file:', err);
      throw new Error('Error uploading the file.');
    }
  };

router.post('/new', authorization, async (req: Request, res: Response, next: NextFunction) => {


    try {
        await createBucket(bucketName, qutUsername, purpose);
    } 
    catch (err) {
        return res.status(500).json({ error: true, message: err });
    }

    const files = req.files as { [fieldname: string]: fileUpload.UploadedFile | fileUpload.UploadedFile[] };
    if (!files || Object.keys(files).length === 0) {
        return res.status(400).json({ error: true, message: "No file uploaded" });
    }


    const file = Array.isArray(files['video']) ? files['video'][0] : files['video'];

    if (!file) {
        return res.status(400).json({ error: true, message: "No video uploaded" });
    }

    const mimeType = file.mimetype;
    if (mimeType.split('/')[0] !== 'video') {
        return res.status(400).json({ error: true, message: "Uploaded file is not a video" });
    }

    const user = (req as any).user;
    const username = user?.username;
    const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
    if (checkUserIsExisting.length === 0) {
        return res.status(404).json({ Error: true, Message: 'User does not exist! using jwt without a registered user.' });
    }

    if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(404).json({ error: true, message: "Username failed to be retrieved" });
    }

    const userForeignKeyFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
    if (userForeignKeyFind.length < 0) {
        return res.status(404).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
    }
    const userForeignKey = userForeignKeyFind[0].id;
    try {

        if (file) {
            const videoFile = Array.isArray(files['video']) ? files['video'][0] : files['video'];
            const uploadPath = path.join(__dirname, '../Users', username, 'uploaded', 'videos');

            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }

            const uniqueID = crypto.randomBytes(16).toString("hex");
            const ext = path.extname(videoFile.name);
            const newFilename = uniqueID + ext;
            const videoUploadPath = path.join(uploadPath, newFilename);
            //fs.writeFileSync(videoUploadPath, videoFile.data);
            
            try {
                const data = await checkVideoMetadataBuffer(file.data);
                
                const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
                if (!videoStream) {
                    throw new Error("No video stream found in the file.");
                }
                const bitRate: number = typeof data.format.bit_rate === 'number' ? data.format.bit_rate : 0;

                const metadata: NewUsersVideos = {
                    userid: userForeignKey,
                    originalName: videoFile.name,
                    mimeType: videoFile.mimetype,
                    size: videoFile.size,
                    path: videoUploadPath,
                    newFilename: newFilename,
                    duration: data.format.duration as number,
                    bit_rate: bitRate,
                    codec: videoStream.codec_name as string,
                    width: videoStream.width as number,
                    height: videoStream.height as number,
                };

                try {
                    await storeObject(bucketName, file, username);
                    
                } 
                catch (err) {
                    return res.status(500).json({ error: true, message: err });
                }

                await db.insertInto('uservideos').values(metadata).executeTakeFirst();
                return res.status(200).json({ error: false, message: "Video stored successfully.", MetaData: metadata });

            } catch (err) {
                if (fs.existsSync(videoUploadPath)) {
                    fs.unlinkSync(videoUploadPath);
                }
                return res.status(500).json({ error: true, message: "Error extracting video metadata", err });
            }
        }
    } catch (err) {
        return res.status(500).json({ error: true, message: "Error processing file", err });
    }
});

module.exports = router;
