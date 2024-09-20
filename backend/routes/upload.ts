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
import ffmpeg from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath); 
router.use(fileUpload());


function checkVideoMetadata(filePath: string): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err: Error, data: ffmpeg.FfprobeData) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

router.post('/new', authorization, async (req: Request, res: Response, next: NextFunction) => {
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

            fs.writeFileSync(videoUploadPath, videoFile.data);


            try {
                const data = await checkVideoMetadata(videoUploadPath);
                
                const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
                if (!videoStream) {
                    throw new Error("No video stream found in the file.");
                }

                const metadata: NewUsersVideos = {
                    userid: userForeignKey,
                    originalName: videoFile.name,
                    mimeType: videoFile.mimetype,
                    size: videoFile.size,
                    path: videoUploadPath,
                    newFilename: newFilename,
                    duration: data.format.duration as number,
                    bit_rate: data.format.bit_rate as number,
                    codec: videoStream.codec_name as string,
                    width: videoStream.width as number,
                    height: videoStream.height as number,
                };

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
