import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../db/client";

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
