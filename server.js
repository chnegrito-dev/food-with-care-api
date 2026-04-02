const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "Food With Care API running" });
});

app.post("/api/send-signed-doc", async (req, res) => {
  try {
    const { stopReference, phoneNumber, signedAt, signatureDataUrl } = req.body;

    if (!stopReference || !phoneNumber || !signedAt || !signatureDataUrl) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields",
      });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    page.drawText("Food With Care - Please Leave the box", {
      x: 50,
      y: height - 50,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Stop Reference: ${stopReference}`, {
      x: 50,
      y: height - 100,
      size: 12,
      font,
    });

    page.drawText(`Phone Number: ${phoneNumber}`, {
      x: 50,
      y: height - 120,
      size: 12,
      font,
    });

    page.drawText(`Signed At: ${signedAt}`, {
      x: 50,
      y: height - 140,
      size: 12,
      font,
    });

    const pngBase64 = signatureDataUrl.replace(/^data:image\/png;base64,/, "");
    const pngBytes = Buffer.from(pngBase64, "base64");
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const pngDims = pngImage.scale(0.5);

    page.drawText("Signature:", {
      x: 50,
      y: height - 190,
      size: 12,
      font: boldFont,
    });

    page.drawImage(pngImage, {
      x: 50,
      y: height - 420,
      width: pngDims.width,
      height: pngDims.height,
    });

    const pdfBytes = await pdfDoc.save();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.OFFICE_EMAIL,
      subject: `Food With Care Authorization Signed - Stop ${stopReference}`,
      text:
        `A signed authorization has been received.\n\n` +
        `Stop Reference: ${stopReference}\n` +
        `Phone Number: ${phoneNumber}\n` +
        `Signed At: ${signedAt}\n`,
      attachments: [
        {
          filename: `food-with-care-stop-${stopReference}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    });

    return res.json({
      ok: true,
      message: "Signed document emailed successfully",
    });
  } catch (error) {
    console.error("send-signed-doc error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Server error",
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Food With Care API running on port ${PORT}`);
});