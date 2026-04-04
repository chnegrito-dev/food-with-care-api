require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// =========================
// MEMORY STORE
// =========================
const cases = new Map();

// =========================
// UTIL
// =========================
function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  return Buffer.from(base64, "base64");
}

// =========================
// CREATE CASE
// =========================
app.post("/api/create-case", (req, res) => {
  const { caseId, stopId, phone, photoDataUrl } = req.body;

  if (!caseId || !stopId) {
    return res.status(400).json({ error: "Missing data" });
  }

  cases.set(caseId, {
    caseId,
    stopId,
    phone,
    photoDataUrl,
  });

  res.json({ ok: true });
});

// =========================
// GET CASE
// =========================
app.get("/api/get-case/:id", (req, res) => {
  const data = cases.get(req.params.id);

  if (!data) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(data);
});

// =========================
// BUILD PDF
// =========================
async function buildPdf({
  caseId,
  stopId,
  phone,
  signatureDataUrl,
  photoDataUrl,
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - 50;

  // LOGO
  const logoPath = path.join(
    __dirname,
    "public",
    "food-with-care-logo.png"
  );

  if (fs.existsSync(logoPath)) {
    const logoBytes = fs.readFileSync(logoPath);

    let logo;
    try {
      logo = await pdfDoc.embedPng(logoBytes);
    } catch {
      logo = await pdfDoc.embedJpg(logoBytes);
    }

    page.drawImage(logo, {
      x: (width - 180) / 2,
      y: y - 80,
      width: 180,
      height: 80,
    });

    y -= 100;
  }

  // TITLE
  page.drawText("FOOD WITH CARE AUTHORIZATION", {
    x: margin,
    y,
    size: 18,
    font: bold,
  });

  y -= 30;

  // INFO
  page.drawText(`Stop ID: ${stopId}`, { x: margin, y, size: 12, font });
  y -= 20;

  page.drawText(`Case ID: ${caseId}`, { x: margin, y, size: 12, font });
  y -= 20;

  page.drawText(`Phone: ${phone}`, { x: margin, y, size: 12, font });
  y -= 20;

  const now = new Date().toLocaleString();

  page.drawText(`Signed At: ${now}`, {
    x: margin,
    y,
    size: 12,
    font,
  });

  y -= 40;

  // MESSAGE
  page.drawText("PLEASE LEAVE THE BOX", {
    x: margin,
    y,
    size: 16,
    font: bold,
  });

  y -= 20;

  page.drawText("POR FAVOR DEJE LA CAJA", {
    x: margin,
    y,
    size: 14,
    font: bold,
  });

  y -= 30;

  // LINE
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  y -= 30;

  // SIGNATURE
  page.drawText("Signature / Firma", {
    x: margin,
    y,
    size: 14,
    font: bold,
  });

  y -= 120;

  const sigBytes = dataUrlToBytes(signatureDataUrl);
  const sigImg = await pdfDoc.embedPng(sigBytes);

  page.drawImage(sigImg, {
    x: margin,
    y,
    width: 250,
    height: 100,
  });

  // PHOTO
  if (photoDataUrl) {
    const photoBytes = dataUrlToBytes(photoDataUrl);

    let photo;
    try {
      photo = await pdfDoc.embedJpg(photoBytes);
    } catch {
      photo = await pdfDoc.embedPng(photoBytes);
    }

    page.drawImage(photo, {
      x: width - 220,
      y: y + 40,
      width: 180,
      height: 140,
    });
  }

  return await pdfDoc.save();
}

// =========================
// SEND SIGNED DOC
// =========================
app.post("/api/send-signed-doc", async (req, res) => {
  try {
    const { caseId, signatureDataUrl } = req.body;

    const data = cases.get(caseId);

    if (!data) {
      return res.status(404).json({ error: "Case not found" });
    }

    const pdfBytes = await buildPdf({
      caseId,
      stopId: data.stopId,
      phone: data.phone,
      signatureDataUrl,
      photoDataUrl: data.photoDataUrl,
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.OFFICE_EMAIL,
      subject: `Signed Case ${data.stopId}`,
      attachments: [
        {
          filename: "authorization.pdf",
          content: pdfBytes,
        },
      ],
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3001, () => {
  console.log("API running on port 3001");
});