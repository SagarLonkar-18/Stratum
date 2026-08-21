import multer from "multer";
import path from "path";

// Store to a temp location first; we move it to its final path
// (namespaced by workspace + document ID) after creating the Document row.
const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, path.join(process.cwd(), "uploads", "tmp"));
	},
	filename: (_req, file, cb) => {
		cb(null, `${Date.now()}-${file.originalname}`);
	},
});

const ALLOWED_MIME_TYPES = ["application/pdf"];

export const upload = multer({
	storage,
	limits: { fileSize: 20 * 1024 * 1024 }, // 20MB cap
	fileFilter: (_req, file, cb) => {
		if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
			return cb(new Error("only PDF files are supported"));
		}
		cb(null, true);
	},
});
1