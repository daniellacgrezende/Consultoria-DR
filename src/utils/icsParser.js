/**
 * Parser simples de arquivos ICS (iCalendar)
 * Extrai eventos do formato padrão usado por Outlook, Google Calendar, Teams, etc.
 */

function parseICSDate(str) {
  if (!str) return null;
  // Remove TZID prefix if present (e.g., TZID=America/Sao_Paulo:20260411T090000)
  const val = str.includes(":") ? str.split(":").pop() : str;
  // Format: 20260411T090000Z or 20260411T090000
  const clean = val.replace(/[^0-9T]/g, "");
  if (clean.length < 15) return null;
  const y = clean.slice(0, 4);
  const m = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const h = clean.slice(9, 11);
  const min = clean.slice(11, 13);
  const isUTC = val.endsWith("Z");
  const iso = `${y}-${m}-${d}T${h}:${min}:00${isUTC ? "Z" : ""}`;
  return iso;
}

function unfoldLines(text) {
  // ICS spec: lines starting with space/tab are continuations
  return text.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function parseICS(text) {
  const unfolded = unfoldLines(text);
  const lines = unfolded.split("\n");
  const events = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current && current.summary) {
        events.push({
          title: current.summary || "",
          description: (current.description || "").replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\"),
          start_at: parseICSDate(current.dtstart) || "",
          end_at: parseICSDate(current.dtend) || "",
          location: (current.location || "").replace(/\\,/g, ",").replace(/\\\\/g, "\\"),
          outlook_event_id: current.uid || "",
          type: detectEventType(current),
          color: detectColor(current),
          is_teams: !!(current.location || "").toLowerCase().includes("teams") || !!(current.description || "").toLowerCase().includes("teams"),
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    // Parse key:value (handle properties with params like DTSTART;TZID=...)
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const keyPart = trimmed.slice(0, colonIdx).toUpperCase();
    const value = trimmed.slice(colonIdx + 1);

    // Extract base key (before any ;PARAM=value)
    const baseKey = keyPart.split(";")[0];

    switch (baseKey) {
      case "SUMMARY": current.summary = value; break;
      case "DESCRIPTION": current.description = value; break;
      case "DTSTART": current.dtstart = trimmed.slice(trimmed.indexOf(":") > -1 ? 0 : 0); current.dtstart = value; if (keyPart.includes("TZID")) current.dtstart = keyPart + ":" + value; break;
      case "DTEND": current.dtend = value; if (keyPart.includes("TZID")) current.dtend = keyPart + ":" + value; break;
      case "LOCATION": current.location = value; break;
      case "UID": current.uid = value; break;
      case "ORGANIZER": current.organizer = value; break;
      case "STATUS": current.status = value; break;
    }
  }

  return events;
}

function detectEventType(evt) {
  const text = `${evt.summary || ""} ${evt.description || ""} ${evt.location || ""}`.toLowerCase();
  if (text.includes("teams") || text.includes("reunião online") || text.includes("online meeting")) return "reuniao";
  if (text.includes("follow") || text.includes("retorno")) return "followup";
  if (text.includes("lembrete") || text.includes("reminder")) return "lembrete";
  if (text.includes("reunião") || text.includes("meeting") || text.includes("call")) return "reuniao";
  return "reuniao";
}

function detectColor(evt) {
  const type = detectEventType(evt);
  const colors = { reuniao: "#2563eb", followup: "#7c3aed", lembrete: "#f59e0b", pessoal: "#6b7280" };
  return colors[type] || "#2563eb";
}
