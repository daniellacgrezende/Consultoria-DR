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

// Expande um evento recorrente (RRULE) em ocorrências individuais
function expandRecurring(base, rruleStr, exdates, horizonDays = 400) {
  const parts = {};
  (rruleStr || "").split(";").forEach((p) => {
    const eq = p.indexOf("=");
    if (eq > 0) parts[p.slice(0, eq)] = p.slice(eq + 1);
  });

  const freq = parts.FREQ;
  if (!freq) return [base];

  const interval = parseInt(parts.INTERVAL || "1");
  const maxCount = parts.COUNT ? parseInt(parts.COUNT) : 500;

  const baseStart = new Date(base.start_at);
  if (isNaN(baseStart)) return [base];
  const baseEnd   = base.end_at ? new Date(base.end_at) : null;
  const duration  = baseEnd && !isNaN(baseEnd) ? baseEnd - baseStart : 0;

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + horizonDays);

  let untilDate = maxDate;
  if (parts.UNTIL) {
    const u = parseICSDate(parts.UNTIL);
    if (u) { const ud = new Date(u); if (ud < maxDate) untilDate = ud; }
  }

  // Datas excluídas (EXDATE)
  const excludedSet = new Set(
    (exdates || []).flatMap((d) => d.split(",")).map((d) => {
      const p = parseICSDate(d.trim());
      return p ? p.slice(0, 10) : null;
    }).filter(Boolean)
  );

  const results = [];
  let cur = new Date(baseStart);
  let n = 0;

  while (cur <= untilDate && n < maxCount) {
    const dateKey = cur.toISOString().slice(0, 10);
    if (!excludedSet.has(dateKey)) {
      results.push({
        ...base,
        start_at: cur.toISOString(),
        end_at: duration > 0 ? new Date(cur.getTime() + duration).toISOString() : cur.toISOString(),
        // primeira ocorrência mantém o UID original; as demais recebem sufixo de data
        outlook_event_id: n === 0 ? base.outlook_event_id : `${base.outlook_event_id}_${dateKey.replace(/-/g, "")}`,
      });
    }
    n++;
    if      (freq === "DAILY")   cur.setDate(cur.getDate() + interval);
    else if (freq === "WEEKLY")  cur.setDate(cur.getDate() + 7 * interval);
    else if (freq === "MONTHLY") cur.setMonth(cur.getMonth() + interval);
    else if (freq === "YEARLY")  cur.setFullYear(cur.getFullYear() + interval);
    else break;
  }

  return results.length > 0 ? results : [base];
}

export function parseICS(text) {
  const unfolded = unfoldLines(text);
  const lines = unfolded.split("\n");
  const rawEvents = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current && current.summary) {
        rawEvents.push(current);
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

    const baseKey = keyPart.split(";")[0];
    const tzidMatch = keyPart.match(/TZID=([^;]+)/);
    const tzid = tzidMatch ? tzidMatch[1] : null;

    switch (baseKey) {
      case "SUMMARY":       current.summary = value; break;
      case "DESCRIPTION":   current.description = value; break;
      case "DTSTART":
        current.dtstart = value;
        current.dtstart_tzid = tzid;
        break;
      case "DTEND":
        current.dtend = value;
        current.dtend_tzid = tzid;
        break;
      case "LOCATION":      current.location = value; break;
      case "UID":           current.uid = value; break;
      case "ORGANIZER":     current.organizer = value; break;
      case "STATUS":        current.status = value; break;
      case "RRULE":         current.rrule = value; break;
      case "RECURRENCE-ID": current.recurrence_id = value; break;
      case "EXDATE":
        current.exdates = current.exdates || [];
        current.exdates.push(value);
        break;
    }
  }

  // Converte raw → eventos; expande recorrentes
  const events = [];
  for (const raw of rawEvents) {
    const base = {
      title: raw.summary || "",
      description: (raw.description || "").replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\"),
      start_at: parseICSDate(raw.dtstart, raw.dtstart_tzid) || "",
      end_at:   parseICSDate(raw.dtend,   raw.dtend_tzid)   || "",
      location: (raw.location || "").replace(/\\,/g, ",").replace(/\\\\/g, "\\"),
      outlook_event_id: raw.uid || "",
      type:     detectEventType(raw),
      color:    detectColor(raw),
      is_teams: !!(raw.location || "").toLowerCase().includes("teams") || !!(raw.description || "").toLowerCase().includes("teams"),
      status:   (raw.status || "CONFIRMED").toUpperCase(),
    };

    if (raw.rrule && !raw.recurrence_id) {
      // Evento recorrente: expande em ocorrências individuais
      events.push(...expandRecurring(base, raw.rrule, raw.exdates || []));
    } else {
      events.push(base);
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
