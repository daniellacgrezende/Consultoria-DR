import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "../lib/supabase";
import { mapClientFromDB, mapClientToDB, mapLeadToDB, huid, cuid } from "../utils/helpers";

const DataContext = createContext({});

export function DataProvider({ children }) {
  const [clients, setClientsRaw] = useState([]);
  const [history, setHistoryRaw] = useState([]);
  const [repasse, setRepasseRaw] = useState([]);
  const [aportes, setAportesRaw] = useState([]);
  const [reunioes, setReunioesRaw] = useState([]);
  const [todos, setTodosRaw] = useState([]);
  const [leads, setLeadsRaw] = useState([]);
  const [radar, setRadarRaw] = useState([]);
  const [relEnvios, setRelEnviosRaw] = useState({});
  const [pipelineStages, setPipelineStagesRaw] = useState([]);
  const [assetClasses, setAssetClassesRaw] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  // Toast auto-close
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Load all data on mount
  useEffect(() => {
    const load = async () => {
      const [c, h, r, a, rh, td, ld, rd, re, ps, ac] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("history").select("*"),
        supabase.from("repasse").select("*"),
        supabase.from("aportes").select("*"),
        supabase.from("reunioes_hist").select("*"),
        supabase.from("todos").select("*").order("ordem"),
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("radar").select("*"),
        supabase.from("rel_envios").select("*"),
        supabase.from("pipeline_stages").select("*").order("ordem"),
        supabase.from("asset_classes").select("*").order("ordem"),
      ]);

      if (c.error) console.error("Load clients error:", c.error);
      if (ld.error) console.error("Load leads error:", ld.error);
      setClientsRaw((c.data || []).map(mapClientFromDB));
      setHistoryRaw(h.data || []);
      setRepasseRaw(r.data || []);
      setAportesRaw(a.data || []);
      setReunioesRaw(rh.data || []);
      setTodosRaw(td.data || []);
      setLeadsRaw(ld.data || []);
      setRadarRaw(rd.data || []);
      setPipelineStagesRaw(ps.data || []);
      setAssetClassesRaw(ac.data || []);

      // Converter rel_envios de array para map {client_id: mes_envio}
      const envMap = {};
      (re.data || []).forEach((r) => { envMap[r.client_id] = r.mes_envio; });
      setRelEnviosRaw(envMap);

      setLoaded(true);
    };
    load();
  }, []);

  // ─── CLIENTS ───
  const setClients = useCallback((fn) => {
    setClientsRaw((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  const saveClient = useCallback(async (clientData, isNew = false) => {
    const dbData = mapClientToDB(clientData);
    if (isNew) {
      dbData.id = dbData.id || cuid();
      const { data, error } = await supabase.from("clients").insert(dbData).select();
      if (error) { console.error("saveClient insert error:", error); return; }
      if (data) {
        setClientsRaw((p) => [mapClientFromDB(data[0]), ...p]);
        return data[0].id;
      }
    } else {
      const { data, error } = await supabase.from("clients").update(dbData).eq("id", clientData.id).select();
      if (error) { console.error("saveClient update error:", error); return; }
      if (data) setClientsRaw((p) => p.map((c) => (c.id === clientData.id ? mapClientFromDB(data[0]) : c)));
    }
    return clientData.id;
  }, []);

  const deleteClient = useCallback(async (id) => {
    await supabase.from("clients").delete().eq("id", id);
    setClientsRaw((p) => p.filter((c) => c.id !== id));
    setHistoryRaw((p) => p.filter((h) => h.client_id !== id));
  }, []);

  // ─── HISTORY ───
  const setHistory = useCallback((fn) => {
    setHistoryRaw((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  const addHistory = useCallback(async (entry) => {
    const row = { id: huid(), ...entry };
    const { data } = await supabase.from("history").insert(row).select();
    if (data) setHistoryRaw((p) => [...p, data[0]]);
    return row;
  }, []);

  const updateHistory = useCallback(async (id, updates) => {
    await supabase.from("history").update(updates).eq("id", id);
    setHistoryRaw((p) => p.map((h) => (h.id === id ? { ...h, ...updates } : h)));
  }, []);

  const deleteHistory = useCallback(async (id) => {
    await supabase.from("history").delete().eq("id", id);
    setHistoryRaw((p) => p.filter((h) => h.id !== id));
  }, []);

  // ─── REPASSE ───
  const setRepasse = useCallback((fn) => {
    setRepasseRaw((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  const saveRepasse = useCallback(async (entry, isNew = false) => {
    if (isNew) {
      entry.id = entry.id || huid();
      const { data } = await supabase.from("repasse").insert(entry).select();
      if (data) setRepasseRaw((p) => [...p, data[0]]);
    } else {
      await supabase.from("repasse").update(entry).eq("id", entry.id);
      setRepasseRaw((p) => p.map((r) => (r.id === entry.id ? { ...r, ...entry } : r)));
    }
  }, []);

  const deleteRepasse = useCallback(async (id) => {
    await supabase.from("repasse").delete().eq("id", id);
    setRepasseRaw((p) => p.filter((r) => r.id !== id));
  }, []);

  // ─── APORTES ───
  const setAportes = useCallback((fn) => {
    setAportesRaw((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  const saveAporte = useCallback(async (entry, isNew = false) => {
    if (isNew) {
      entry.id = entry.id || huid();
      const { data } = await supabase.from("aportes").insert(entry).select();
      if (data) setAportesRaw((p) => [...p, data[0]]);
    } else {
      await supabase.from("aportes").update(entry).eq("id", entry.id);
      setAportesRaw((p) => p.map((a) => (a.id === entry.id ? { ...a, ...entry } : a)));
    }
  }, []);

  const deleteAporte = useCallback(async (id) => {
    await supabase.from("aportes").delete().eq("id", id);
    setAportesRaw((p) => p.filter((a) => a.id !== id));
  }, []);

  // ─── REUNIÕES ───
  const setReunioes = useCallback((fn) => {
    setReunioesRaw((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  const saveReuniao = useCallback(async (entry, isNew = false) => {
    if (isNew) {
      entry.id = entry.id || huid();
      const { data } = await supabase.from("reunioes_hist").insert(entry).select();
      if (data) setReunioesRaw((p) => [...p, data[0]]);
    } else {
      await supabase.from("reunioes_hist").update(entry).eq("id", entry.id);
      setReunioesRaw((p) => p.map((r) => (r.id === entry.id ? { ...r, ...entry } : r)));
    }
  }, []);

  const deleteReuniao = useCallback(async (id) => {
    await supabase.from("reunioes_hist").delete().eq("id", id);
    setReunioesRaw((p) => p.filter((r) => r.id !== id));
  }, []);

  // ─── TODOS ───
  const setTodos = useCallback((fn) => {
    setTodosRaw((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  const saveTodo = useCallback(async (entry, isNew = false) => {
    if (isNew) {
      entry.id = entry.id || huid();
      const { data } = await supabase.from("todos").insert(entry).select();
      if (data) setTodosRaw((p) => [...p, data[0]]);
    } else {
      await supabase.from("todos").update(entry).eq("id", entry.id);
      setTodosRaw((p) => p.map((t) => (t.id === entry.id ? { ...t, ...entry } : t)));
    }
  }, []);

  const deleteTodo = useCallback(async (id) => {
    await supabase.from("todos").delete().eq("id", id);
    setTodosRaw((p) => p.filter((t) => t.id !== id));
  }, []);

  const clearDoneTodos = useCallback(async () => {
    const doneIds = todos.filter((t) => t.done).map((t) => t.id);
    if (doneIds.length) await supabase.from("todos").delete().in("id", doneIds);
    setTodosRaw((p) => p.filter((t) => !t.done));
  }, [todos]);

  // ─── LEADS ───
  const setLeads = useCallback((fn) => {
    setLeadsRaw((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  const saveLead = useCallback(async (entry, isNew = false) => {
    const dbData = mapLeadToDB(entry);
    if (isNew) {
      dbData.id = dbData.id || huid();
      const { data, error } = await supabase.from("leads").insert(dbData).select();
      if (error) { console.error("saveLead insert error:", error); return; }
      if (data) setLeadsRaw((p) => [data[0], ...p]);
    } else {
      const { error } = await supabase.from("leads").update(dbData).eq("id", entry.id);
      if (error) { console.error("saveLead update error:", error); return; }
      setLeadsRaw((p) => p.map((l) => (l.id === entry.id ? { ...l, ...dbData } : l)));
    }
  }, []);

  const deleteLead = useCallback(async (id) => {
    await supabase.from("leads").delete().eq("id", id);
    setLeadsRaw((p) => p.filter((l) => l.id !== id));
  }, []);

  // ─── RADAR ───
  const setRadar = useCallback((fn) => {
    setRadarRaw((prev) => (typeof fn === "function" ? fn(prev) : fn));
  }, []);

  const saveRadar = useCallback(async (entry, isNew = false) => {
    if (isNew) {
      entry.id = entry.id || huid();
      const { data } = await supabase.from("radar").insert(entry).select();
      if (data) setRadarRaw((p) => [...p, data[0]]);
    } else {
      await supabase.from("radar").update(entry).eq("id", entry.id);
      setRadarRaw((p) => p.map((r) => (r.id === entry.id ? { ...r, ...entry } : r)));
    }
  }, []);

  const deleteRadar = useCallback(async (id) => {
    await supabase.from("radar").delete().eq("id", id);
    setRadarRaw((p) => p.filter((r) => r.id !== id));
  }, []);

  // ─── PIPELINE STAGES ───
  const savePipelineStage = useCallback(async (entry, isNew = false) => {
    if (isNew) {
      const { data } = await supabase.from("pipeline_stages").insert(entry).select();
      if (data) setPipelineStagesRaw((p) => [...p, data[0]].sort((a, b) => a.ordem - b.ordem));
    } else {
      await supabase.from("pipeline_stages").update(entry).eq("id", entry.id);
      setPipelineStagesRaw((p) => p.map((s) => s.id === entry.id ? { ...s, ...entry } : s));
    }
  }, []);

  const deletePipelineStage = useCallback(async (id) => {
    await supabase.from("pipeline_stages").delete().eq("id", id);
    setPipelineStagesRaw((p) => p.filter((s) => s.id !== id));
  }, []);

  // ─── ASSET CLASSES ───
  const saveAssetClass = useCallback(async (entry, isNew = false) => {
    if (isNew) {
      const { data } = await supabase.from("asset_classes").insert(entry).select();
      if (data) setAssetClassesRaw((p) => [...p, data[0]].sort((a, b) => a.ordem - b.ordem));
    } else {
      await supabase.from("asset_classes").update(entry).eq("id", entry.id);
      setAssetClassesRaw((p) => p.map((c) => c.id === entry.id ? { ...c, ...entry } : c));
    }
  }, []);

  const deleteAssetClass = useCallback(async (id) => {
    await supabase.from("asset_classes").delete().eq("id", id);
    setAssetClassesRaw((p) => p.filter((c) => c.id !== id));
  }, []);

  // ─── REL ENVIOS ───
  const setRelEnvios = useCallback(async (clientId, mesEnvio) => {
    if (mesEnvio) {
      await supabase.from("rel_envios").upsert({ client_id: clientId, mes_envio: mesEnvio });
    } else {
      await supabase.from("rel_envios").delete().eq("client_id", clientId);
    }
    setRelEnviosRaw((p) => {
      const n = { ...p };
      if (mesEnvio) n[clientId] = mesEnvio;
      else delete n[clientId];
      return n;
    });
  }, []);

  const value = {
    // Data
    clients, history, repasse, aportes, reunioes, todos, leads, radar, relEnvios,
    pipelineStages, assetClasses, loaded, toast,
    // Setters
    setClients, setHistory, setRepasse, setAportes, setReunioes, setTodos, setLeads, setRadar,
    // CRUD operations
    saveClient, deleteClient,
    addHistory, updateHistory, deleteHistory,
    saveRepasse, deleteRepasse,
    saveAporte, deleteAporte,
    saveReuniao, deleteReuniao,
    saveTodo, deleteTodo, clearDoneTodos,
    saveLead, deleteLead,
    saveRadar, deleteRadar,
    setRelEnvios,
    savePipelineStage, deletePipelineStage,
    saveAssetClass, deleteAssetClass,
    setToast,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
