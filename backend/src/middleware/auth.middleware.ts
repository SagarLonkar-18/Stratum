import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extends Express's Request type so req.userId is recognized by TypeScript
// wherever this middleware has run.
declare global {
	namespace Express {
		interface Request {
			userId?: string;
		}
	}
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res
			.status(401)
			.json({ error: "missing or invalid authorization header" });
	}

	const token = authHeader.slice("Bearer ".length);
	const secret = process.env.JWT_SECRET;

	if (!secret) {
		console.error("JWT_SECRET is not set");
		return res.status(500).json({ error: "internal server error" });
	}

	try {
		const payload = jwt.verify(token, secret) as { userId: string };
		req.userId = payload.userId;
		next();
	} catch (err) {
		return res.status(401).json({ error: "invalid or expired token" });
	}
}
