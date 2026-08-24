import express from "express";
import authRouter from "./routes/auth.routes";
import workspaceRouter from "./routes/workspace.routes";
import documentRouter from "./routes/document.routes";
import queryRouter from "./routes/query.routes";

const app = express();
app.use(express.json());

app.use("/auth", authRouter);
app.use("/workspaces", workspaceRouter);
app.use("/workspaces/:workspaceId/documents", documentRouter);
app.use("/workspaces/:workspaceId/query", queryRouter);

app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
	console.log(`Server listening on :${PORT}`);
});
