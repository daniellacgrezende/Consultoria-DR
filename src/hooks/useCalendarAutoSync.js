/**
 * Auto-sincronização do calendário Outlook/ICS
 * - Roda ao abrir o sistema (se URL salva)
 * - Roda novamente a cada 60 minutos em segundo plano
 */
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { parseICS } from "../utils/icsParser";
import { huid } from "../utils/helpers";

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
const LAST_SYNC_KEY = "outlook_last_sync";

async function runAutoSync() {
  const url = localStorage.getItem("outlook_ics_url");
  if (!url) return; // sem URL configurada, não faz nada

  try {
    const resp = await fetch(`/api/calendar-proxy?url=${encodeURIComponent(url)}`);
    if (!resp.ok) return;
    const text = await resp.text();
    if (!text.includes("BEGIN:VCALENDAR")) return;

    const parsed = parseICS(text);
    const validParsed = parsed.filter((e) => e.start_at && e.outlook_event_id);
    if (!validParsed.length) return;

    // Incremental: só insere eventos que ainda não existem no banco
    const { data: existing } = await supabase
      .from("calendar_events")
      .select("outlook_event_id");

    const existingIds = new Set(
      (existing || []).filter((e) => e.outlook_event_id).map((e) => e.outlook_event_id)
    );

    const newEvents = validParsed.filter((e) => !existingIds.has(e.outlook_event_id));
    if (!newEvents.length) {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return;
    }

    const toInsert = newEvents.map((e) => ({
      id: huid(),
      title: e.title,
      description: e.description || "",
      start_at: e.start_at,
      end_at: e.end_at || e.start_at,
      type: e.type || "reuniao",
      color: e.color || "#2563eb",
      location: e.location || "",
      outlook_event_id: e.outlook_event_id,
      client_id: null,
      lead_id: null,
    }));

    await supabase.from("calendar_events").insert(toInsert);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    console.log(`[CalSync] ${toInsert.length} novo(s) evento(s) importado(s) automaticamente.`);
  } catch (err) {
    console.warn("[CalSync] Erro na sincronização automática:", err.message);
  }
}

export function useCalendarAutoSync() {
  useEffect(() => {
    const url = localStorage.getItem("outlook_ics_url");
    if (!url) return;

    // Verifica quando foi o último sync
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    const msSinceLast = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity;

    // Roda imediatamente se nunca sincronizou ou faz mais de 1h
    if (msSinceLast > SYNC_INTERVAL_MS) {
      runAutoSync();
    }

    // Agenda sync a cada 1 hora
    const interval = setInterval(runAutoSync, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
}
