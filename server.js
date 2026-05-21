//import path from "path";
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

import path from "path";

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

    // supprimer harakat
    .replace(/[ًٌٍَُِّْـ]/g, "")

    // normaliser alifs
    .replace(/[آأإٱ]/g, "ا")

    // normaliser espaces
    .replace(/\s+/g, " ")

    // supprimer ponctuation arabe et française
    .replace(/[.,!?;:،؛؟"'`~()[\]{}\-_/\\]/g, "")

    // supprimer caractères invisibles
    .replace(/[\u200B-\u200D\uFEFF]/g, "")

    // supprimer tout sauf arabe + espaces
    .replace(/[^\u0600-\u06FF\s]/g, "")

    // trim final
    .trim();
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/recognize", upload.single("audio"), async (req, res) => {
  try {
    const expectedList = JSON.parse(
      req.body.expectedList || "[]"
    );

    console.log("Liste attendue :", expectedList);
    console.log("Fichier reçu :", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier audio reçu." });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-1",
      language: "ar",
      response_format: "text"
    });

    fs.unlinkSync(req.file.path);

    const text = transcription || "";
    const normalized = normalizeArabic(text);
    const target = normalizeArabic("أحب");

    res.json({
      text,
      normalized
      //success: normalized === target
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
