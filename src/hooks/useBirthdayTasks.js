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

    const active = clients.filter((c) => c.status === "ativo");

    const tasks = [];

    const addBirthdayTask = (rawDate, texto) => {
      if (!rawDate || rawDate.length < 10) return;
      const mmdd = rawDate.slice(5, 10);
      if (!mmdd || mmdd.length !== 5) return;
      const birthdayThisYear = `${currentYear}-${mmdd}`;
      if (birthdayThisYear < today()) return;
      const alreadyExists = todos.some(
        (t) => t.texto === texto && t.vencimento && t.vencimento.startsWith(String(currentYear))
      );
      if (!alreadyExists) {
        tasks.push({
          id: huid(),
          texto,
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
    };

    for (const c of active) {
      if (c.data_nascimento) {
        addBirthdayTask(c.data_nascimento || c.dataNascimento, `🎂 Aniversário — ${c.nome}`);
      }
      const rawParceiro = c.data_nascimento_parceiro || c.dataNascimentoParceiro;
      if (rawParceiro) {
        const nomeParceiro = c.conjuge ? `${c.conjuge} (parceiro de ${c.nome.split(" ")[0]})` : `Parceiro de ${c.nome.split(" ")[0]}`;
        addBirthdayTask(rawParceiro, `🎂 Aniversário — ${nomeParceiro}`);
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
