const jwt = require('jsonwebtoken');
import { Request, Response, NextFunction } from 'express';



let tokenBlacklist: string[] = [];

function blacklistToken(token: string) {
    tokenBlacklist.push(token);
}


function isTokenBlacklisted(token: string): boolean {
    return tokenBlacklist.includes(token);
}

module.exports = function (req: Request, res: Response, next: NextFunction) {
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
        res.status(401).json({ error: true, message: "Token has been blacklisted ( You logged out!)" });
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        (req as any).user = decoded;
    } catch (error) {
        const e = error as Error;
        if (e.name === "TokenExpiredError") {
            res.status(401).json({ error: true, message: "JWT token has expired" });
        } else {
            res.status(401).json({ error: true, message: "Invalid JWT token" });
        }
        return;
    }

    next();
};

module.exports.blacklistToken = blacklistToken;
module.exports.isTokenBlacklisted = isTokenBlacklisted;