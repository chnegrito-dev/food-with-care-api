import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { caseId, stopId, phone, photoDataUrl } = req.body;

    if (!caseId || !stopId || !phone) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = 750;

    page.drawText("Food With Care Delivery Authorization", {
      x: 50,
      y,
      size: 18,
      font,
      color: rgb(0, 0, 0),
    });

    y -= 40;

    page.drawText(`Stop Reference: ${stopId}`, {
      x: 50,
      y,
      size: 12,
      font,
    });

    y -= 20;

    page.drawText(`Phone: ${phone}`, {
      x: 50,
      y,
      size: 12,
      font,
    });

    y -= 20;

    page.drawText(`Signed At: ${new Date().toLocaleString()}`, {
      x: 50,
      y,
      size: 12,
      font,
    });

    y -= 50;

    page.drawText("Please Leave The Box", {
      x: 50,
      y,
      size: 16,
      font,
    });

    y -= 20;

    page.drawText("Por Favor Deje La Caja", {
      x: 50,
      y,
      size: 14,
      font,
    });

    y -= 60;

    if (photoDataUrl) {
      const base64 = photoDataUrl.split(",")[1];
      const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const image = await pdfDoc.embedJpg(imageBytes);

      page.drawImage(image, {
        x: 50,
        y: y - 200,
        width: 200,
        height: 150,
      });

      y -= 220;
    }

    const pdfBytes = await pdfDoc.save();

    return res.status(200).json({
      message: "Case created",
      pdf: Buffer.from(pdfBytes).toString("base64"),
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
}