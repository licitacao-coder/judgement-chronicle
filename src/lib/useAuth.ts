import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Perfil = {
  id: string;
  nome: string | null;
  matricula: string | null;
  cargo: string | null;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [papel, setPapel] = useState<string>("CONSULTA");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        setPerfil(null);
        setPapel("CONSULTA");
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setCarregando(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("id, nome, matricula, cargo").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (p) setPerfil(p as Perfil);
      const papeis = (r ?? []).map((x: { role: string }) => x.role);
      setPapel(
        papeis.includes("ADMIN")
          ? "ADMIN"
          : papeis.includes("REVISOR")
            ? "REVISOR"
            : papeis.includes("ANALISTA")
              ? "ANALISTA"
              : "CONSULTA",
      );
    })();
  }, [user]);

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return {
    session,
    user,
    perfil,
    papel,
    carregando,
    podeAprovar: papel === "ADMIN" || papel === "REVISOR",
    ehAdministrador: papel === "ADMIN",
    sair,
  };
}

export async function registrarAuditoria(registro: {
  acao: string;
  entidade: string;
  entidade_id?: string | null;
  detalhes?: Record<string, unknown> | null;
}) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("auditoria").insert({
    usuario_id: data.user.id,
    acao: registro.acao,
    entidade: registro.entidade,
    entidade_id: registro.entidade_id ?? null,
    detalhes: (registro.detalhes ?? null) as never,
  });
}
