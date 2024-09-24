import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';



const clientId = "90agsomhqesnc58a4jerenl72";
const userPoolId = "ap-southeast-2_oOgmb1Jdz";
const verifier = CognitoJwtVerifier.create({
    userPoolId: userPoolId,
    clientId: clientId,
    tokenUse: "access",
});


let tokenBlacklist: string[] = [];

function blacklistToken(token: string) {
    tokenBlacklist.push(token);
}


function isTokenBlacklisted(token: string): boolean {
    return tokenBlacklist.includes(token);
}

module.exports = async function (req: Request, res: Response, next: NextFunction) {
    if (!("authorization" in req.headers)) {
        res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
        return;
    }

    const authorization = req.headers.authorization;
    if (!authorization || !authorization.match(/^Bearer /)) {
        res.status(401).json({ error: true, message: "Authorization header is malformed" });
        return;
    }

    const token = authorization.replace(/^Bearer /, "");

    if (isTokenBlacklisted(token)) {
        res.status(401).json({ error: true, message: "Token has been blacklisted (You logged out!)" });
        return;
    }

    try {
        // Verify the token using aws-jwt-verify
        const payload = await verifier.verify(token);
        (req as any).user = payload;
    } catch (error) {
        res.status(401).json({ error: true, message: "Invalid or expired JWT token" });
        return;
    }

    next();
};

module.exports.blacklistToken = blacklistToken;
module.exports.isTokenBlacklisted = isTokenBlacklisted;