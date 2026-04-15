/**
 * Parser simples de arquivos ICS (iCalendar)
 * Extrai eventos do formato padrão usado por Outlook, Google Calendar, Teams, etc.
 */

// Mapeia timezones comuns para offset UTC
const TZ_OFFSETS = {
  "america/sao_paulo":   "-03:00",
  "america/fortaleza":   "-03:00",
  "america/recife":      "-03:00",
  "america/belem":       "-03:00",
  "america/bahia":       "-03:00",
  "america/manaus":      "-04:00",
  "america/cuiaba":      "-04:00",
  "america/porto_velho": "-04:00",
  "america/boa_vista":   "-04:00",
  "america/rio_branco":  "-05:00",
  "america/new_york":    "-05:00",
  "america/chicago":     "-06:00",
  "america/denver":      "-07:00",
  "america/los_angeles": "-08:00",
  "europe/lisbon":       "+00:00",
  "europe/london":       "+00:00",
};

function getTZOffset(tzid) {
  if (!tzid) return "";
  const key = tzid.toLowerCase().replace(/\s/g, "_");
  return TZ_OFFSETS[key] || "-03:00"; // default Brasil
}

function parseICSDate(str, tzid) {
  if (!str) return null;
  // Remove TZID prefix if present (e.g., TZID=America/Sao_Paulo:20260411T090000)
  const val = str.includes(":") ? str.split(":").pop() : str;
  // Format: 20260411T090000Z or 20260411T090000
  const clean = val.replace(/[^0-9T]/g, "");
  if (clean.length < 8) return null;
  const y = clean.slice(0, 4);
  const m = clean.slice(4, 6);
  const d = clean.slice(6, 8);

  // All-day event (no time part)
  if (clean.length < 15) return `${y}-${m}-${d}T00:00:00`;

  const h = clean.slice(9, 11);
  const min = clean.slice(11, 13);
  const isUTC = val.endsWith("Z");

  if (isUTC) {
    // Already UTC — keep as-is, will be converted to local on display
    return `${y}-${m}-${d}T${h}:${min}:00Z`;
  }

  if (tzid) {
    // Has explicit timezone: append the UTC offset so Supabase stores correctly
    const offset = getTZOffset(tzid);
    return `${y}-${m}-${d}T${h}:${min}:00${offset}`;
  }

  // No timezone (floating time) — treat as local Brazil time
  return `${y}-${m}-${d}T${h}:${min}:00-03:00`;
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
          start_at: parseICSDate(current.dtstart, current.dtstart_tzid) || "",
          end_at: parseICSDate(current.dtend, current.dtend_tzid) || "",
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

    // Extract base key (before any ;PARAM=value) and extract TZID if present
    const baseKey = keyPart.split(";")[0];
    const tzidMatch = keyPart.match(/TZID=([^;]+)/);
    const tzid = tzidMatch ? tzidMatch[1] : null;

    switch (baseKey) {
      case "SUMMARY":     current.summary = value; break;
      case "DESCRIPTION": current.description = value; break;
      case "DTSTART":
        current.dtstart = value;
        current.dtstart_tzid = tzid;
        break;
      case "DTEND":
        current.dtend = value;
        current.dtend_tzid = tzid;
        break;
      case "LOCATION":   current.location = value; break;
      case "UID":        current.uid = value; break;
      case "ORGANIZER":  current.organizer = value; break;
      case "STATUS":     current.status = value; break;
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
