import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.static("."));

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + ".wav");
  }
});

const upload = multer({ storage });

console.log("Clé API présente ?", process.env.OPENAI_API_KEY ? "OUI" : "NON");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function normalizeArabic(text) {
  return text
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:،؛؟"'`~()[\]{}\-_/\\]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\u0600-\u06FF\s]/g, "")
    .trim();
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/recognize", upload.single("audio"), async (req, res) => {
  try {
    console.log("Fichier reçu :", req.file);

    if (!req.file) {
      return res.status(400).json({
        error: "Aucun fichier audio reçu."
      });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "gpt-4o-transcribe",
      language: "ar",
      response_format: "text",
      prompt: "Transcris uniquement la parole arabe entendue. Si le son n'est pas clair, ne devine pas."
    });

    fs.unlinkSync(req.file.path);

    const text = transcription || "";
    const normalized = normalizeArabic(text);

    res.json({
      text,
      normalized
    });

  } catch (error) {
    console.error("ERREUR COMPLÈTE :", error);

    res.status(500).json({
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
