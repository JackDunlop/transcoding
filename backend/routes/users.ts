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
import { S3Client, DeleteObjectCommand ,GetObjectCommand  } from '@aws-sdk/client-s3';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";


import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { use } from 'passport';
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
      console.log(`Error fetching parameter ${parameter_name}:`, error)
      return undefined
    }
  }
  

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
    const clientId = await getParameterValue('/n11431415/assignment/clientId');
    const userPoolId = await getParameterValue('/n11431415/assignment/userPoolId');
    if (!clientId) {
      throw new Error('Missing required Cognito configuration');
    }
    const client = new Cognito.CognitoIdentityProviderClient({ region: 'ap-southeast-2' });
    const command = new Cognito.SignUpCommand({
      ClientId: clientId,
      Username: username,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    });

    try {
      const cognitoResponse = await client.send(command);
      const addUserToGroupCommand = new Cognito.AdminAddUserToGroupCommand({
        GroupName: 'default',
        UserPoolId: userPoolId,
        Username: username,
      });
      await client.send(addUserToGroupCommand);
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



router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ Error: true, Message: 'Missing Username and Password' });
  }

  try {
    const client = new CognitoIdentityProviderClient({ region: 'ap-southeast-2' });
    const clientId = await getParameterValue('/n11431415/assignment/clientId');
    if (!clientId) {
      throw new Error('Missing required Cognito configuration');
    }

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

      const otpauthUrl = `otpauth://totp/AwesomeTranscoding:${username}?secret=${secretCode}&issuer=AwesomeTranscoding`;


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
  const clientId = await getParameterValue('/n11431415/assignment/clientId');
  if (!clientId) {
    throw new Error('Missing required Cognito configuration');
  }
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

const bucketName = 'n11431415-assignment-two';

const deleteObject = async (bucketName: string, objectKey: string) => {
  const s3Client = new S3Client({ region: 'ap-southeast-2' });

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    const response = await s3Client.send(command);
    return response;
  } catch (err) {
    throw err;
  }
};
// users/delete/:key
router.post('/delete', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const username = user?.username;
    const groups = user?.groups || [];

    if (!groups.includes('admin')) {
      return res.status(403).json({ error: true, message: 'Access denied. Admin privileges are required.' });
    }

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(500).json({ error: true, message: "Username failed to be retrieved" });
    }

    const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
    if (checkUserIsExisting.length === 0) {
      return res.status(400).json({ Error: true, Message: 'User does not exist! Using JWT without a registered user.' });
    }

    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: true, message: 'Key is required.' });
    }

    await deleteObject(bucketName, key);
    const findTranscodedVideo = await db.deleteFrom('uservideotranscoded').where('path', '=', key).execute();


    res.status(200).json({ message: 'Object deleted successfully.' });
  } catch (error) {
    return res.status(400).json({ Error: true, Message: error });
  }
});


router.post('/secertRetriever', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: true, message: 'Secret name is required.' });
    }
    const client = new SecretsManagerClient({
      region: "ap-southeast-2",
    });
    
    let response;

    response = await client.send(
        new GetSecretValueCommand({
          SecretId: name,
          VersionStage: "AWSCURRENT", 
      })
    );
   
    const secret = response.SecretString;

    res.status(200).json({ message: 'Retrieved successfully.', secert: secret});
  } catch (error) {
    return res.status(400).json({ Error: true, Message: error });
  }
});



import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand,ScanCommand } from "@aws-sdk/lib-dynamodb";


const client = new DynamoDBClient({ region: 'ap-southeast-2' }); 
const docClient = DynamoDBDocumentClient.from(client);

router.post('/feedback', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const username = user?.username;
    const { feedback } = req.body;
    if (!feedback) {
      return res.status(400).json({ error: true, message: 'Must include feedback.' });
    }

    const timestamp = new Date().toISOString(); 
   const qutUsername  = await getParameterValue('/n11431415/assignment/qutUsername');
  const tableName  = await getParameterValue('/n11431415/assignment/tableName');
    
   const command = new PutCommand({
      TableName: tableName,
      Item: {
        "qut-username": qutUsername,
        "timestamp": timestamp, 
        user: {
          submittedby: username,
          feedback: feedback
        }
      }
    });

    try {
      const response = await docClient.send(command);
      console.log("Put command response:", response);
      res.status(200).json({ message: 'Feedback submitted.' });
    } catch (err) {
      console.error('Error submitting feedback:', err);
      res.status(500).json({ error: true, message: 'Failed to submit feedback.' });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(400).json({ error: true, message: 'An unexpected error occurred.' });
  }
});
router.get('/getallfeedback', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const qutUsername  = await getParameterValue('/n11431415/assignment/qutUsername');
    const tableName  = await getParameterValue('/n11431415/assignment/tableName');
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: "#username = :username",
      ExpressionAttributeNames: {
        "#username": "qut-username"
      },
      ExpressionAttributeValues: {
        ":username": qutUsername
      }
    });
    try {
      const response = await docClient.send(command);
      if (!response.Items || response.Items.length === 0) {
        return res.status(404).json({ error: true, message: 'No feedback found.' });
      }
      console.log(response);
      const feedback = response.Items.map(item => ({
        submittedby: item.user.submittedby,
        feedback: item.user.feedback,
        timestamp: item.timestamp 
      }));
    
      res.status(200).json({ feedback });
    } catch (err) {
      console.error('Error retrieving feedback:', err);
      res.status(500).json({ error: true, message: 'Failed to retrieve feedback.' });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(400).json({ error: true, message: 'An unexpected error occurred.' });
  }
});

router.post('/parameterRetriever', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: true, message: 'Parameter name is required.' });
    }
    const paramter = await getParameterValue(name);

    res.status(200).json({ message: 'Retrieved successfully.', paramter: paramter});
  } catch (error) {
    return res.status(400).json({ Error: true, Message: error });
  }
});


router.get('/listtranscodedadmin', authorization, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const username = user?.username;
    const groups = user?.groups || []; 
    console.log(groups);


    if (!groups.includes('admin')) {
      return res.status(403).json({ error: true, message: 'Access denied. Admin privileges are required.' });
    }

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(500).json({ error: true, message: "Username failed to be retrieved" });
    }

    const checkUserIsExisting = await db.selectFrom('users').selectAll().where('username', '=', username).execute();
    if (checkUserIsExisting.length === 0) {
      return res.status(400).json({ Error: true, Message: 'User does not exist! Using JWT without a registered user.' });
    }

    const userTranscodedIDFind = await db.selectFrom('users').select('id').where('username', '=', username).execute();
    if (userTranscodedIDFind.length === 0) {
      return res.status(400).json({ Error: true, Message: 'Cannot find user who uploaded this video.' });
    }

    const userTranscodedID = userTranscodedIDFind[0].id;

    const usersTranscodedVideos = await db
      .selectFrom('uservideotranscoded')
      .select(['originalName', 'mimeType', 'size', 'duration', 'bit_rate', 'codec', 'width', 'height', 'newFilename', 'path'])
      .execute();

    if (usersTranscodedVideos.length === 0) {
      return res.status(200).json({ Error: false, Message: 'You have not uploaded anything.' });
    }

    return res.status(200).json({ Error: false, transcodedList: usersTranscodedVideos });

  } catch (error) {
    next(error);
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
    return res.status(400).json({ Error: true, Message: error });
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
    return res.status(400).json({ Error: true, Message: error });
  }
});




module.exports = router;
