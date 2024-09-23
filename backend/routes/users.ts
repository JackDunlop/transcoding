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
      return res.status(500).json({ Error: true, Message: 'Internal Server Error: JWT_SECRET not defined' });
    }
    const jwtToken = jwt.sign({ username, expire }, secret);

    return res.status(200).json({ jwtToken, token_type: "Bearer", jwtExpireTimeIn });


  } catch (Error) {
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


interface ListReturn {
  videoNameUploaded: string;
  videoNameTypeUploaded: string;
  originalName: string;
  mimeType: string;
  size: number;
  duration: number;
  bit_rate: number;
  codec: string;
  width: number;
  height: number;
}

router.get('/list', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const username = user?.username;

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(500).json({ error: true, message: "Username failed to be retrieved" });
    }

    // Check if user exists in the database
    const checkUserIsExisting = await db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .execute();

    if (checkUserIsExisting.length === 0) {
      return res.status(400).json({
        Error: true,
        Message: 'User does not exist! using jwt without a registered user.',
      });
    }

    const userIDFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
    if (userIDFind.length < 0) {
      return res.status(400).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
    }
    const userID = userIDFind[0].id;

    const userUploadedVideos = await db.selectFrom("uservideos").select(['originalName', 'mimeType', 'size', 'duration', 'bit_rate', 'codec', 'width', 'height', 'newFilename']).where('userid', '=', userID).execute();
    if (userUploadedVideos.length < 0) {
      return res.status(200).json({ Error: false, Message: 'You have not uploaded anything.' });
    }

    return res.status(200).json({ Error: false, userUploadedVideos: userUploadedVideos });
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
