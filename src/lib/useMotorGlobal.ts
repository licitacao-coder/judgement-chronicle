import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { obterConfigMotor } from "@/lib/motores.functions";
import { useAuth } from "@/lib/useAuth";

export type Motor = "INTERNO" | "PYTHON";

const CHAVE = "motor_analise";
const EVENTO = "motor-analise-alterado";

function lerGravado(): Motor {
  if (typeof window === "undefined") return "INTERNO";
  return window.localStorage.getItem(CHAVE) === "PYTHON" ? "PYTHON" : "INTERNO";
}

/**
 * Escolha única de todo o sistema: “Usar IA” ou “Usar Local” (serviço do órgão).
 * Fica gravada no navegador e vale para leitura, análise, ocorrências, linha do
 * tempo, itens aceitos e redação do relatório.
 */
export function useMotorGlobal() {
  const [motor, setMotorEstado] = useState<Motor>("INTERNO");

  const { data: config } = useQuery({
    queryKey: ["configuracao_motor"],
    queryFn: () => obterConfigMotor(),
  });
  const localDisponivel = !!config?.endereco_servico && config.situacao === "ATIVO";

  useEffect(() => {
    setMotorEstado(lerGravado());
    const ouvir = () => setMotorEstado(lerGravado());
    window.addEventListener(EVENTO, ouvir);
    window.addEventListener("storage", ouvir);
    return () => {
      window.removeEventListener(EVENTO, ouvir);
      window.removeEventListener("storage", ouvir);
    };
  }, []);

  const definirMotor = useCallback((novo: Motor) => {
    window.localStorage.setItem(CHAVE, novo);
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  // Serviço local fora do ar: tudo volta para a IA automaticamente.
  const efetivo: Motor = motor === "PYTHON" && !localDisponivel ? "INTERNO" : motor;

  return {
    motor: efetivo,
    escolhido: motor,
    definirMotor,
    localDisponivel,
    versaoLocal: config?.versao_servico ?? null,
  };
}
