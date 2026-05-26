import { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";

declare global {
  namespace Express {
    interface Request {
      user?: { email: string };
    }
  }
}

export default async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }

    const token = header.split(" ")[1];
    const secret = process.env.NEXTAUTH_SECRET || "";
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    if (!payload.email || typeof payload.email !== "string") {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = { email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
