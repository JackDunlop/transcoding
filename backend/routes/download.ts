var express = require('express');
import { Request, Response, NextFunction } from 'express';
var router = express.Router();
const authorization = require("../middleware/auth.ts");
import { db } from './database'
var fs = require('fs');


router.get('/:transcode_id', authorization, async (req: Request, res: Response, next: NextFunction) => {

    const transcode_id = req.params.transcode_id;
    const transcodeIdNumber = parseInt(transcode_id, 10);
    if (isNaN(transcodeIdNumber) || !Number.isInteger(transcodeIdNumber) || transcodeIdNumber === 0) {
        return res.status(500).json({ error: true, message: "You need to include a valid id of the video you would like to download." });
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
    if (userIDFind.length < 0) {
        return res.status(400).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
    }
    const querieduserID = userIDFind[0].id;
    console.log(querieduserID);
    //console.log(userTranscodedID)

    const checkIfUserUploaded = await db.selectFrom("uservideotranscoded").selectAll().where('userid', '=', querieduserID).execute();
    if (checkIfUserUploaded.length === 0) {
        return res.status(400).json({ Error: true, Message: 'You have not uploaded a video for what you have selected.' });
    }

    const findTranscodeID = await db.selectFrom("uservideotranscoded").select('path').where('userTranscodeID', '=', transcodeIdNumber).execute();
    if (findTranscodeID.length === 0) {
        return res.status(400).json({ Error: true, Message: 'Incorrect Video Selected' });
    }
    // const transcodeID = findTranscodeID[0].id;
    //const transcodeName = findTranscodeID[0].newFilename;
    const transcodePath = findTranscodeID[0].path;

    console.log(transcodePath);
    fs.access(transcodePath, fs.constants.F_OK, (err: Error) => {
        if (err) {
            return res.status(404).json({ error: true, message: 'File not found' });
        }
        res.download(transcodePath, (err) => {
            if (err) {
                return next(err);
            }
        });
    });


    // backend\Users\test\transcode\video



    //return res.status(200).json({ Error: false, Message: 'Downloaded!' });
});



module.exports = router;