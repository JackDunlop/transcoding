var express = require('express');
var router = express.Router();
var path = require('path');
import { Request, Response, NextFunction } from 'express';
import { db } from './database';
var fs = require('fs');
const authorization = require("../middleware/auth.ts");
import ffmpeg from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath); 
import { NewUsersVideosTranscoded } from './databasetypes'
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


router.post('/video/:video_name', authorization, async (req: Request, res: Response, next: NextFunction) => {

    const user = (req as any).user;
    const username = user?.username;
    const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
    if (checkUserIsExisting.length === 0) {
        return res.status(403).json({ Error: true, Message: 'User does not exist! using jwt without a registered user.' });
    }

    if (!username || typeof username !== 'string' || username.trim() === '') {
        return res.status(404).json({ error: true, message: "Username failed to be retrieved" });
    }
    const videoName = req.params.video_name;
    const width = req.body.width;
    const height = req.body.height;
    const bitrate = req.body.bitrate;
    const codec = req.body.codec;
    const format = req.body.format;
    const framerate = req.body.framerate;

    

    if (!videoName || !width || !bitrate || !codec || !format || !framerate || !height) {
        return res.status(400).json({ error: true, message: "You are missing a required parameter...",  });
    }


    // console.log(videoName, width, bitrate, codec, format, framerate);
    const userVideoPathQuery = await db.selectFrom('uservideos').select('path').where('newFilename', '=', videoName).execute();
    if (userVideoPathQuery.length === 0) {
        return res.status(404).json({ error: true, message: "No Video has been uploaded matching that name." });
    }
    const uploadedVideoPath = userVideoPathQuery[0].path;
    if (!fs.existsSync(uploadedVideoPath)) {
        return res.status(404).json({ error: true, message: "The file path does not exist." });
    }

    const transcodePath = path.join(__dirname, '../Users', username, 'transcode', 'video');
    // console.log(transcodePath)
    if (!fs.existsSync(transcodePath)) {
        fs.mkdirSync(transcodePath, { recursive: true });
    }

    const outputFileName = `${path.parse(videoName).name}.mp4`;
    const outputFilePath = path.join(transcodePath, outputFileName);

    const resolution: string = width && height ? `${width}x${height}` : ``;


    

    //console.log(uploadedVideoPath);

    const userForeignKeyFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
    if (userForeignKeyFind.length < 0) {
        return res.status(404).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
    }
    const userForeignKey = userForeignKeyFind[0].id;

    const videoOriginalNameFind = await db.selectFrom("uservideos").select("originalName").where("newFilename", '=', videoName).execute();
    const originalName = videoOriginalNameFind[0].originalName;

    const data = await checkVideoMetadata(uploadedVideoPath);



    const userTranscodedIDFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
    if (userTranscodedIDFind.length < 0) {
        return res.status(404).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
    }
    const userTranscodedID = userTranscodedIDFind[0].id;


    var transcodeID = 0;



    const usersTranscodedVideos = await db.selectFrom("uservideotranscoded").selectAll().where('userid', '=', userTranscodedID).execute();
    if (usersTranscodedVideos.length < 0) {
        transcodeID = 0;
    }
    else {
        const transodeIDSearchLength = usersTranscodedVideos.length
        transcodeID = transodeIDSearchLength + 1;
    }


    transcodingProgress[transcodeID] = { status: 'started', progress: 0 };
    const command = ffmpeg(uploadedVideoPath)
      .size(resolution)
      .videoBitrate(bitrate)
      .videoCodec(codec)
      .format(format)
      .fps(framerate)
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
          console.log(`FFmpeg process started with PID: ${pid}`);
        }
      })
      .on('progress', (progress) => {
        transcodingProgress[transcodeID].progress = progress.percent || 0;
      })
      .on('end', () => {
        transcodingProgress[transcodeID].status = 'finished';
        transcodingProgress[transcodeID].progress = 100;
        delete ffmpegProcesses[transcodeID]; 
        const size = data.format?.size || 0;

    const metadata: NewUsersVideosTranscoded = {
        userid: userForeignKey,
        originalName: originalName,
        mimeType: format,
        size: size,
        path: outputFilePath,
        newFilename: outputFileName,
        duration: data.format.duration as number,
        bit_rate: bitrate,
        codec: codec,
        width: width,
        height: height,
        userTranscodeID: transcodeID
    };

     db.insertInto('uservideotranscoded').values(metadata).executeTakeFirst();

      })
      .on('error', (err) => {
        console.error('Error during transcoding:', err.message);
        transcodingProgress[transcodeID] = { status: 'error', progress: 0 };
        delete ffmpegProcesses[transcodeID]; 
      })
      .save(outputFilePath);
    
      
    
    return res.status(200).json({ error: false, message: "Transcoding started.", transcodeID });



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

        if (!videoName || typeof videoName !== 'string' || videoName.trim() === '') {
            return res.status(400).json({ error: true, message: 'Invalid video name' });
        }
        
        const filePath = path.join(__dirname, '..', 'Users', username, 'transcode', 'video', `${videoName}.mp4`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: true, message: 'Video file not found' , path : filePath});
        }


        const stat = fs.statSync(filePath);
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Content-Length': stat.size,
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    } catch (error) {
        next(error);
    }
});

router.post('/kill/:transcode_id', authorization, async (req: Request, res: Response) => {
    const transcodeID = parseInt(req.params.transcode_id, 10);

    if (isNaN(transcodeID) || !Number.isInteger(transcodeID) || transcodeID <= 0) {
        return res.status(400).json({ error: true, message: 'Invalid transcode ID.' });
    }

    const processInfo = ffmpegProcesses[transcodeID];
    if (!processInfo) {
        return res.status(404).json({ error: true, message: 'FFmpeg process not found.' });
    }

    try {
        processInfo.process.kill('SIGKILL');
        delete ffmpegProcesses[transcodeID];
        delete transcodingProgress[transcodeID];
        res.status(200).json({ message: 'FFmpeg process terminated successfully.' });
    } catch (error) {
        //console.error('Error killing FFmpeg process:', error);
        res.status(500).json({ error: true, message: 'Failed to terminate FFmpeg process.' });
    }
});




module.exports = router;
