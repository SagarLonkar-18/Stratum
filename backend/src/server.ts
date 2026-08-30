import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.routes";
import workspaceRouter from "./routes/workspace.routes";
import documentRouter from "./routes/document.routes";
import queryRouter from "./routes/query.routes";
import hybridQueryRouter from "./routes/hybridQuery.routes";
import rerankedQueryRouter from "./routes/rerankedQuery.routes";
import chatRouter from "./routes/chat.routes";
import conversationRouter from "./routes/conversation.routes";

const app = express();
app.use(
	cors({
		origin: "http://localhost:5173",
		credentials: true,
	}),
);
app.use(express.json());

app.use("/auth", authRouter);
app.use("/workspaces", workspaceRouter);
app.use("/workspaces/:workspaceId/documents", documentRouter);
app.use("/workspaces/:workspaceId/query", queryRouter);
app.use("/workspaces/:workspaceId/hybrid-query", hybridQueryRouter);
app.use("/workspaces/:workspaceId/reranked-query", rerankedQueryRouter);
app.use("/workspaces/:workspaceId/chat", chatRouter);
app.use("/workspaces/:workspaceId/conversations", conversationRouter);

app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
	console.log(`Server listening on :${PORT}`);
});
