import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
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
  




let tokenBlacklist: string[] = [];

function blacklistToken(token: string) {
    tokenBlacklist.push(token);
}


function isTokenBlacklisted(token: string): boolean {
    return tokenBlacklist.includes(token);
}

module.exports = async function (req: Request, res: Response, next: NextFunction) {
    if (!('authorization' in req.headers)) {
      res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
      return;
    }
  
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.match(/^Bearer /)) {
      res.status(401).json({ error: true, message: 'Authorization header is malformed' });
      return;
    }
  
    const token = authorization.replace(/^Bearer /, '');
  
    if (isTokenBlacklisted(token)) {
      res.status(401).json({ error: true, message: 'Token has been blacklisted (You logged out!)' });
      return;
    }
  
    try {
      const clientId = await getParameterValue('/n11431415/assignment/clientId');
      const userPoolId = await getParameterValue('/n11431415/assignment/userPoolId');
  
      if (!userPoolId || !clientId) {
        throw new Error('Missing required Cognito configuration');
      }
  
      const verifier = CognitoJwtVerifier.create({
        userPoolId: userPoolId,
        clientId: clientId,
        tokenUse: 'access',
      });
  
      const payload = await verifier.verify(token);
  
      const username = payload['username'] || payload['cognito:username'];
      const groups = payload['cognito:groups'] || [];
  
      (req as any).user = {
        username,
        groups,
      };
    } catch (error) {
      res.status(401).json({ error: true, message: 'Invalid or expired JWT token' });
      return;
    }
  
    next();
  };
  
module.exports.blacklistToken = blacklistToken;
module.exports.isTokenBlacklisted = isTokenBlacklisted;