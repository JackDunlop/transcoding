var express = require('express');
import { Request, Response, NextFunction } from 'express';
var router = express.Router();
const authorization = require("../middleware/auth.ts");
import { db } from './database'
var fs = require('fs');
const S3Presigner = require("@aws-sdk/s3-request-presigner");
import { S3Client, GetObjectCommand  } from '@aws-sdk/client-s3';
const S3 = require("@aws-sdk/client-s3");
const bucketName = 'n11431415-assignment-two';
const s3Client = new S3Client({ region: 'ap-southeast-2' });
import { Readable } from 'stream';
const retrieveObjectUrl = async (bucketName: string, objectKey: string): Promise<string> => {
    const s3Client = new S3Client({ region: 'ap-southeast-2' });
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

  router.get('/:videoname', authorization, async (req: Request, res: Response, next: NextFunction) => {
    const videoname = req.params.videoname;
    if (!videoname) {
        return res.status(500).json({ error: true, message: "You need to include a valid videoname of the video you would like to download." });
    }

    const user = (req as any).user;
    const username = user?.username;
    if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(500).json({ error: true, message: "Username failed to be retrieved" });
    }

    const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
    if (checkUserIsExisting.length === 0) {
        return res.status(400).json({ Error: true, Message: 'User does not exist! using jwt without a registered user.' });
    }

    const userIDFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
    if (userIDFind.length === 0) {
        return res.status(400).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
    }

    const querieduserID = userIDFind[0].id;

    const checkIfUserUploaded = await db.selectFrom("uservideotranscoded").selectAll().where('userid', '=', querieduserID).execute();
    if (checkIfUserUploaded.length === 0) {
        return res.status(400).json({ Error: true, Message: 'You have not uploaded a video for what you have selected.' });
    }

    const s3Key = `users/${username}/transcoded/${videoname}`;

    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
        });

        const s3Response = await s3Client.send(command);
        res.setHeader('Content-Type', s3Response.ContentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${videoname}"`);

        const stream = s3Response.Body as Readable;
        stream.pipe(res).on('error', (err : Error) => {
            res.status(500).json({ error: true, message: 'Error downloading the file.' });
        });
    } catch (err) {
        return res.status(500).json({ error: true, message: 'Error downloading the file.' });
    }
});



module.exports = router;