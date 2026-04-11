/**
 * Vercel Serverless Function - Proxy para buscar calendário ICS via URL
 * Necessário porque o browser bloqueia requisições diretas (CORS)
 */
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL não fornecida" });
  }

  // Validar que é uma URL de calendário válida
  try {
    const parsed = new URL(url);
    const allowed = ["outlook.office365.com", "outlook.live.com", "calendar.google.com", "outlook.office.com"];
    if (!allowed.some((h) => parsed.hostname.includes(h))) {
      return res.status(400).json({ error: "Domínio não permitido. Use URLs do Outlook ou Google Calendar." });
    }
  } catch {
    return res.status(400).json({ error: "URL inválida" });
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "ConsultoriaDR-CalSync/1.0" },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Erro ao buscar calendário: ${response.statusText}` });
    }

    const text = await response.text();

    // Verify it's ICS content
    if (!text.includes("BEGIN:VCALENDAR")) {
      return res.status(400).json({ error: "O conteúdo não é um calendário válido (ICS)" });
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: `Erro interno: ${err.message}` });
  }
}
