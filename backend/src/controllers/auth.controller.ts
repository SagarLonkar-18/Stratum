import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db/client";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 12;

export async function register(req: Request, res: Response) {
	const { email, password } = req.body;

	if (!email || !password) {
		return res
			.status(400)
			.json({ error: "email and password are required" });
	}
	if (password.length < 8) {
		return res
			.status(400)
			.json({ error: "password must be at least 8 characters" });
	}

	try {
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			return res.status(409).json({ error: "email already registered" });
		}

		const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
		const user = await prisma.user.create({
			data: { email, passwordHash },
		});

		return res.status(201).json({ id: user.id, email: user.email });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}

export async function login(req: Request, res: Response) {
	const { email, password } = req.body;

	if (!email || !password) {
		return res
			.status(400)
			.json({ error: "email and password are required" });
	}

	try {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			// Deliberately the same error as a wrong password — never reveal
			// whether an email exists in the system, that's an enumeration leak.
			return res.status(401).json({ error: "invalid email or password" });
		}

		const passwordMatches = await bcrypt.compare(
			password,
			user.passwordHash,
		);
		if (!passwordMatches) {
			return res.status(401).json({ error: "invalid email or password" });
		}

		const secret = process.env.JWT_SECRET;
		if (!secret) {
			throw new Error("JWT_SECRET is not set");
		}

		const token = jwt.sign({ userId: user.id }, secret, {
			expiresIn: "24h",
		});

		return res.status(200).json({ token });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "internal server error" });
	}
}
