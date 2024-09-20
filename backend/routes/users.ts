var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');
import fs from 'fs';
import path from 'path';
const USERS_DIRECTORY = path.join(__dirname, '..', 'Users');
const { blacklistToken } = require('../middleware/auth');
import { Request, Response, NextFunction } from 'express';
import { db } from './database'
import { UserUpdate, User, NewUser } from './databasetypes'
const authorization = require("../middleware/auth.ts");

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  const username: string = req.body.username;
  const password: string = req.body.password;
  const DOB: string = req.body.dob;
  const fullname: string = req.body.fullname;
  const email: string = req.body.email;

  if (!username || !password || !DOB || !fullname || !email) {
    res.status(400).json({ Error: true, Message: 'Missing Username, Password, DOB, Fullname, or Email' });
    return;
  }

  try {
    const checkUserIsExisiting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
    if (checkUserIsExisiting.length > 0) {
      res.status(400).json({ Error: true, Message: 'Username Already In Use.' });
      return;
    }

    const checkEmailIsExisiting = await db.selectFrom('users').selectAll().where('email', '=', email).execute();
    if (checkEmailIsExisiting.length > 0) {
      res.status(400).json({ Error: true, Message: 'Username Email In Use.' });
      return;
    }

    const saltRounds = 10;
    const hash = bcrypt.hashSync(password, saltRounds);

    const newUser: NewUser = {
      username: username,
      hash: hash,
      DOB: DOB,
      fullname: fullname,
      email: email
    };

    await db.insertInto('users').values(newUser).executeTakeFirst();


    const userDir = path.join(USERS_DIRECTORY, username);
    const uploadDir = path.join(userDir, 'uploaded');
    const videosDir = path.join(uploadDir, 'videos');


    fs.mkdirSync(userDir, { recursive: true });
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.mkdirSync(videosDir, { recursive: true });


    return res.status(201).json({ Error: false, Message: 'User successfully added' });
  } catch (error) {
    return res.status(500).json({ Error: true, Message: 'Database query failed', error });
  }
});


router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  const username: string = req.body.username;
  const password: string = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ Error: true, Message: 'Missing Username and Password' });
  }

  try {

    const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();

    if (checkUserIsExisting.length === 0) {
      return res.status(400).json({ Error: true, Message: 'User does not exist.' });
    }
    const match = await bcrypt.compare(password, checkUserIsExisting[0].hash);
    if (!match) {
      return res.status(401).json({ Error: false, Message: 'Invalid password.' });
    }


    const jwtExpireTimeIn = 60 * 2;
    const expire = Math.floor(Date.now() / 1000) + jwtExpireTimeIn;
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not defined');
      return res.status(500).json({ Error: true, Message: 'Internal Server Error: JWT_SECRET not defined' });
    }
    const jwtToken = jwt.sign({ username, expire }, secret);

    return res.status(200).json({ jwtToken, token_type: "Bearer", jwtExpireTimeIn });


  } catch (Error) {
    console.log(Error);
    return res.status(500).json({ Error: true, Message: 'Invalid' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(400).json({ Error: true, Message: 'No token provided.' });
  }
  blacklistToken(token);
  return res.status(200).json({ Error: false, Message: 'Logged out successfully. Token has been invalidated.' });
});


interface FileStructure {
  [key: string]: FileStructure | string;
}




function buildFileStructure(dirPath: string): FileStructure {
  const result: FileStructure = {};
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      result[file] = buildFileStructure(fullPath);
    } else {
      const baseName = path.basename(file, path.extname(file));
      result[file] = baseName;
    }
  });

  return result;
}

interface ListReturn {
  videoNameUploaded: string
  videoNameTypeUploaded: string
  originalName: string
  mimeType: string
  size: number
  duration: number
  bit_rate: number
  codec: string
  width: number
  height: number

}
router.get('/list', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const username = user?.username;

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(500).json({ error: true, message: "Username failed to be retrieved" });
    }

    const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
    if (checkUserIsExisting.length === 0) {
      return res.status(400).json({ Error: true, Message: 'User does not exist! using jwt without a registered user.' });
    }

    const userDir = path.join(__dirname, '../Users', username);
    if (!fs.existsSync(userDir)) {
      return res.status(404).json({ error: true, message: "User directory not found" });
    }

    const fileStructure = buildFileStructure(userDir);
    const uploadedDir = fileStructure.uploaded;
    const videoInfoArray: ListReturn[] = [];

    if (uploadedDir && typeof uploadedDir !== 'string' && 'videos' in uploadedDir) {
      const videosDir = uploadedDir.videos;
      if (videosDir && typeof videosDir !== 'string') {
        const videoEntries = Object.entries(videosDir);
        for (const [fileName, baseName] of videoEntries) {
          if (typeof baseName === 'string') {
            console.log(baseName);
            const videoInfo = await db.selectFrom('uservideos').selectAll().where('newFilename', '=', fileName).execute();
            let videoDetails: ListReturn;
            if (videoInfo.length > 0) {
              const videoMetadata = videoInfo[0]; 
              videoDetails = {
                videoNameUploaded: fileName,
                videoNameTypeUploaded: baseName,
                originalName: videoMetadata.originalName,
                mimeType: videoMetadata.mimeType,
                size: videoMetadata.size,
                duration: videoMetadata.duration,
                bit_rate: videoMetadata.bit_rate,
                codec: videoMetadata.codec,
                width: videoMetadata.width,
                height: videoMetadata.height,
              };
            } else {
              return res.status(500).json({ Error: true, Message: 'Error finding your videos' });
            }
            videoInfoArray.push(videoDetails);
          }
        }
      }
    }



   
    
    return res.status(200).json({ Error: false, FileStructure: videoInfoArray });

  } catch (error) {
    next(error);
  }
});


router.get('/listtranscoded', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const username = user?.username;

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(500).json({ error: true, message: "Username failed to be retrieved" });
    }

    const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
    if (checkUserIsExisting.length === 0) {
      return res.status(400).json({ Error: true, Message: 'User does not exist! using jwt without a registered user.' });
    }

    const userTranscodedIDFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
    if (userTranscodedIDFind.length < 0) {
      return res.status(400).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
    }
    const userTranscodedID = userTranscodedIDFind[0].id;

    const usersTranscodedVideos = await db.selectFrom("uservideotranscoded").select(['originalName', 'mimeType', 'size', 'duration', 'bit_rate', 'codec', 'width', 'height', 'newFilename']).where('userid', '=', userTranscodedID).execute();
    if (usersTranscodedVideos.length < 0) {
      return res.status(200).json({ Error: false, Message: 'You have not uploaded anything.' });
    }

    return res.status(200).json({ Error: false, transcodedList: usersTranscodedVideos });

  } catch (error) {
    next(error);
  }
});




module.exports = router;
