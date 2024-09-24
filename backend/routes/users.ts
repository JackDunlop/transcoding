var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt');
import fs from 'fs';
import path from 'path';
const USERS_DIRECTORY = path.join(__dirname, '..', 'Users');
const { blacklistToken } = require('../middleware/auth');
import { Request, Response, NextFunction } from 'express';
import { db } from './database'
import { UserUpdate, User, NewUser } from './databasetypes'
const authorization = require("../middleware/auth.ts");
const Cognito = require("@aws-sdk/client-cognito-identity-provider");
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AuthFlowType,
  InitiateAuthCommandInput,
  InitiateAuthCommandOutput,
  RespondToAuthChallengeCommandInput,
  RespondToAuthChallengeCommandOutput,SignUpCommand,AssociateSoftwareTokenCommand,VerifySoftwareTokenCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import QRCode from 'qrcode'; 



const clientId = "90agsomhqesnc58a4jerenl72";
const userPoolId = "ap-southeast-2_oOgmb1Jdz";

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  const username: string = req.body.username;
  const password: string = req.body.password;
  const DOB: string = req.body.dob;
  const fullname: string = req.body.fullname;
  const email: string = req.body.email;
  const phone: string = req.body.phone;

  if (!username || !password || !DOB || !fullname || !email || !phone) {
    res.status(400).json({ Error: true, Message: 'Missing Username, Password, DOB, Fullname, or Email' });
    return;
  }


    const phoneNumber = phone;
    const phoneNumberParsed = parsePhoneNumberFromString(phoneNumber, 'AU'); 

    if (!phoneNumberParsed || !phoneNumberParsed.isValid()) {
      return res.status(400).json({ Error: true, Message: 'Invalid phone number format.' });
    }

    const e164PhoneNumber = phoneNumberParsed.format('E.164');

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

    const client = new Cognito.CognitoIdentityProviderClient({ region: 'ap-southeast-2' });
    const command = new Cognito.SignUpCommand({
      ClientId: clientId,
      Username: username,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    });

    try {
      const cognitoResponse = await client.send(command);
      
    } catch (cognitoError) {
      
      return res.status(500).json({ Error: true, Message: 'Cognito sign-up failed', cognitoError });
    }


  
   

    const newUser: NewUser = {
      username: username,
      hash: hash,
      DOB: DOB,
      fullname: fullname,
      email: email,
      phone: e164PhoneNumber
    };

    await db.insertInto('users').values(newUser).executeTakeFirst();

    return res.status(201).json({ Error: false, Message: 'User successfully added' });
  } catch (error) {
    return res.status(500).json({ Error: true, Message: 'Database query failed', error });
  }
});

const accessVerifier = CognitoJwtVerifier.create({
  userPoolId: userPoolId,
  tokenUse: 'access',
  clientId: clientId,
});

const idVerifier = CognitoJwtVerifier.create({
  userPoolId: userPoolId,
  tokenUse: 'id',
  clientId: clientId,
});


router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ Error: true, Message: 'Missing Username and Password' });
  }

  try {
    const client = new CognitoIdentityProviderClient({ region: 'ap-southeast-2' });


    const initiateAuthCommandInput: InitiateAuthCommandInput = {
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH, 
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
      ClientId: clientId,
    };
    const response = await client.send(new InitiateAuthCommand(initiateAuthCommandInput));

    if (response.ChallengeName === 'MFA_SETUP') {
      const associateCommand = new AssociateSoftwareTokenCommand({
        Session: response.Session,
      });

      const associateResponse = await client.send(associateCommand);
      const secretCode = associateResponse.SecretCode;

      const otpauthUrl = `otpauth://totp/YourAppName:${username}?secret=${secretCode}&issuer=AwesomeTranscoding`;


      QRCode.toDataURL(otpauthUrl, (err, url) => {
        if (err) {
          return res.status(500).json({ Error: true, Message: 'Failed to generate QR code', error: err });
        }

        return res.status(200).json({
          Message: 'Please complete the MFA setup by scanning the QR code with your authenticator app.',
          qrCodeUrl: url, 
          Session: associateResponse.Session,
        });
      });
    
    } 
    else if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
      return res.status(200).json({
        Message: 'Please enter the MFA code from your authenticator app.',
        Session: response.Session,
      });}
    else if (response.AuthenticationResult) {
      const { IdToken, AccessToken, TokenType, ExpiresIn } = response.AuthenticationResult;
      return res.status(200).json({
        idToken: IdToken,
        accessToken: AccessToken,
        tokenType: TokenType,
        expiresIn: ExpiresIn,
      });
    } else {
      return res.status(400).json({ Error: true, Message: 'Unexpected response during login', response });
    }
  } catch (error) {
    return res.status(500).json({ Error: true, Message: 'Internal server error during login', error });
  }
});



router.post('/setup-mfa', async (req: Request, res: Response) => {
  const { session, userCode } = req.body;

  if (!session || !userCode) {
    return res.status(400).json({ Error: true, Message: 'Missing parameters.' });
  }

  try {
    const client = new CognitoIdentityProviderClient({ region: 'ap-southeast-2' });

    const verifyCommand = new VerifySoftwareTokenCommand({
      Session: session,
      UserCode: userCode, 
      FriendlyDeviceName: 'Authenticator App',
    });

    const verifyResponse = await client.send(verifyCommand);
    if (verifyResponse.Status === 'SUCCESS') {
      return res.status(200).json({ Message: 'MFA setup complete. You can now use TOTP for authentication.' });
    } else {
      res.status(400).json({ Error: true, Message: 'Failed to verify MFA setup.' });
    }
  } catch (error) {
    res.status(500).json({ Error: true, Message: 'Failed to verify MFA setup.', error });
  }
});


router.post('/verify-mfa', async (req: Request, res: Response) => {
  const { session, userCode, username } = req.body;

  if (!session || !userCode || !username) {
    return res.status(400).json({ Error: true, Message: 'Missing parameters.' });
  }

  try {
    const client = new CognitoIdentityProviderClient({ region: 'ap-southeast-2' });

    const respondToAuthChallengeCommandInput: RespondToAuthChallengeCommandInput = {
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      ClientId: clientId,
      ChallengeResponses: {
        USERNAME: username,
        SOFTWARE_TOKEN_MFA_CODE: userCode,
      },
      Session: session,
    };

    const mfaResponse = await client.send(new RespondToAuthChallengeCommand(respondToAuthChallengeCommandInput));
    if (mfaResponse.AuthenticationResult) {
      const { IdToken, AccessToken, TokenType, ExpiresIn } = mfaResponse.AuthenticationResult;
      return res.status(200).json({
        idToken: IdToken,
        accessToken: AccessToken,
        tokenType: TokenType,
        expiresIn: ExpiresIn,
      });
    } else {
      return res.status(400).json({ Error: true, Message: 'Failed to verify MFA setup.', mfaResponse });
    }
  } catch (error) {
    res.status(500).json({ Error: true, Message: 'Failed to verify MFA setup.', error });
  }
});

const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client('868548258247-hodf86aqk5e8u3tjkv4ttm3891hbkqdr.apps.googleusercontent.com');

router.post('/google-login', async (req: Request, res: Response) => {
  const { idToken } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClient,
    });

    const payload = ticket.getPayload();
    const { sub, email, name } = payload;
    const cognitoClient = new CognitoIdentityProviderClient({ region: 'ap-southeast-2' });

    const command = new InitiateAuthCommand({
      AuthFlow: 'CUSTOM_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: sub, 
      },
    });

    const cognitoResponse = await cognitoClient.send(command);
    
    const accessToken = cognitoResponse.AuthenticationResult?.AccessToken;

    if (!accessToken) {
      return res.status(401).json({ error: 'Failed to authenticate' });
    }

    res.json({ accessToken });

  } catch (error) {
    console.error('Error during Google sign-in:', error);
    res.status(500).json({ error: 'Internal server error' });
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
