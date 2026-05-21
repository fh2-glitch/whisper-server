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

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

function normalizeArabic(text) {
  return text
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/[.,!?;:،؛؟"'`~()[\]{}\-_/\\]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }

  return matrix[b.length][a.length];
}

function findBestMatch(recognized, expectedList) {
  const normalizedRecognized = normalizeArabic(recognized).replace(/\s/g, "");

  let best = null;
  let bestScore = Infinity;

  for (const expected of expectedList) {
    const normalizedExpected = normalizeArabic(expected).replace(/\s/g, "");

    const score = levenshtein(normalizedRecognized, normalizedExpected);

    if (score < bestScore) {
      bestScore = score;
      best = expected;
    }
  }

  return {
    bestMatch: best,
    distance: bestScore
  };
}

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
    const parasites = [
  "شكرا على المشاهدة",
  "اشتركوا في القناة",
  "والى اللقاء في الحلقة القادمة",
  "لا تنسوا الاشتراك"
];

const isParasite = parasites.some(p =>
  normalized.includes(normalizeArabic(p))
);

if (isParasite) {
  return res.json({
    text,
    normalized,
    bestMatch: "",
    success: false,
    reason: "parasite"
  });
}

let bestMatch = "";
let distance = null;
let success = false;

if (expectedList.length) {
  const result = findBestMatch(normalized, expectedList);

  bestMatch = result.bestMatch;
  distance = result.distance;

  // seuil à ajuster
  success = distance <= 2;
}
    //const target = normalizeArabic("أحب");

    res.json({
      text,
      normalized,
      bestMatch,
      distance,
      success
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
