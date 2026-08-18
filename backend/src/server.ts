import express from "express";
import authRouter from "./routes/auth.routes";

const app = express();
app.use(express.json());

app.use("/auth", authRouter);

app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
	console.log(`Server listening on :${PORT}`);
});
