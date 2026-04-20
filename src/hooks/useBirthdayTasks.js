import { useEffect } from "react";
import { useData } from "./useData";
import { huid, today } from "../utils/helpers";

/**
 * Cria automaticamente tarefas de aniversário no To-Do para clientes ativos
 * que possuem data_nascimento preenchida.
 * - Roda uma vez após os dados carregarem.
 * - Não duplica: ignora se já existir tarefa de aniversário para aquele cliente no ano corrente.
 * - Só cria tarefas para aniversários que ainda não passaram no ano corrente (ou que são hoje).
 */
export function useBirthdayTasks() {
  const { clients, todos, saveTodo, loaded } = useData();

  useEffect(() => {
    if (!loaded) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    // MM-DD de hoje para comparação
    const todayMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const active = clients.filter((c) => c.status === "ativo" && c.data_nascimento);

    const tasks = [];

    for (const c of active) {
      const raw = c.data_nascimento || c.dataNascimento;
      if (!raw || raw.length < 10) continue;

      // Extrai MM-DD da data de nascimento
      const mmdd = raw.slice(5, 10); // "MM-DD"
      if (!mmdd || mmdd.length !== 5) continue;

      // Data do aniversário no ano corrente
      const birthdayThisYear = `${currentYear}-${mmdd}`;

      // Se já passou este ano, pular
      if (birthdayThisYear < today()) continue;

      // Padrão de texto único para detecção de duplicatas
      const expectedTexto = `🎂 Aniversário — ${c.nome}`;

      // Verifica se já existe tarefa para este cliente neste ano
      const alreadyExists = todos.some(
        (t) =>
          t.texto === expectedTexto &&
          t.vencimento &&
          t.vencimento.startsWith(String(currentYear))
      );

      if (!alreadyExists) {
        tasks.push({
          id: huid(),
          texto: expectedTexto,
          recorrencia: "anual",
          vencimento: birthdayThisYear,
          descricao: "",
          prioridade: "normal",
          done: false,
          done_at: null,
          data: today(),
          ordem: 9999,
        });
      }
    }

    if (tasks.length === 0) return;

    // Insere todas as tarefas novas de uma vez (sequencial para não sobrecarregar)
    const insert = async () => {
      for (const task of tasks) {
        await saveTodo(task, true);
      }
    };
    insert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
}
