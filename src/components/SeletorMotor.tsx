import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMotorGlobal, type Motor } from "@/lib/useMotorGlobal";

/** Escolha única de todo o sistema: análise pela IA ou pelo serviço local do órgão. */
export function SeletorMotor() {
  const { escolhido, definirMotor, localDisponivel, versaoLocal } = useMotorGlobal();

  return (
    <div className="flex items-center gap-2">
      <span className="label-field text-sidebar-foreground/60">Análise</span>
      <Select
        value={escolhido}
        onValueChange={(v) => {
          definirMotor(v as Motor);
          toast.success(
            v === "PYTHON"
              ? "Tudo passará a ser analisado pelo serviço local do órgão."
              : "Tudo passará a ser analisado pela inteligência artificial.",
          );
        }}
      >
        <SelectTrigger className="h-8 w-[190px] bg-background text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INTERNO">Usar IA</SelectItem>
          <SelectItem value="PYTHON" disabled={!localDisponivel}>
            {localDisponivel
              ? `Usar Local${versaoLocal ? ` · ${versaoLocal}` : ""}`
              : "Usar Local · indisponível"}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
