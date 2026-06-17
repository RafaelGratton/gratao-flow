"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Informe um email válido."),
  password: z.string().min(1, "Informe a senha.")
});

type LoginForm = z.infer<typeof loginSchema>;

type LoginResponse = {
  access_token: string;
  token_type: string;
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-canvas">
          <div className="h-10 w-10 rounded-full border-2 border-accent border-r-transparent animate-spin" />
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  async function onSubmit(values: LoginForm) {
    setApiError(null);
    try {
      const response = await api.post<LoginResponse>("/auth/login", values);
      setToken(response.access_token);
      router.replace(searchParams.get("next") || "/dashboard");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-canvas lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-nav p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(201,151,43,0.22),transparent_46%),radial-gradient(circle_at_72%_30%,rgba(255,255,255,0.08),transparent_22rem)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Gratão Uniformes"
              className="h-16 w-24 rounded-sm object-contain shadow-[0_18px_36px_rgba(0,0,0,0.24)]"
            />
            <div>
              <p className="text-lg font-black">Gratão Flow</p>
              <p className="text-sm text-white/62">Sistema de Produção</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/58">
            Gratão Uniformes
          </p>
          <h1 className="mt-5 text-5xl font-black leading-tight">
            Gestão profissional para acompanhar a produção com clareza.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-white/62">
            Acesso centralizado para acompanhar ordens, serviços, estoque, equipe e fechamentos da
            operação.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3">
          {["Corte", "DTF", "Confecção"].map((item) => (
            <div key={item} className="rounded-md border border-white/10 bg-white/[0.045] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">
                Etapa
              </p>
              <p className="mt-2 font-bold">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md p-6">
          <div className="mb-8 text-center">
            <img
              src="/logo.png"
              alt="Gratão Uniformes"
              className="mx-auto mb-5 h-28 w-auto max-w-[18rem] rounded-sm object-contain shadow-[0_18px_40px_rgba(17,17,17,0.14)]"
            />
            <h1 className="text-3xl font-black text-ink">Gratão Flow</h1>
            <p className="mt-2 text-sm font-semibold text-muted">
              Sistema de Produção - Gratão Uniformes
            </p>
          </div>

          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-accent-soft text-accent-dark">
              <LockKeyhole size={22} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-dark">
              Acesso administrativo
            </p>
            <h2 className="mt-2 text-2xl font-black text-ink">Entrar no sistema</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Informe suas credenciais para acessar o painel operacional.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Senha"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            {apiError ? (
              <div className="rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                {apiError}
              </div>
            ) : null}

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Entrar
              <ArrowRight size={17} />
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-md border border-line bg-[#FFFDF8] p-3">
            <ShieldCheck className="mt-0.5 text-success" size={18} />
            <p className="text-xs leading-5 text-muted">
              Acesso protegido para uso administrativo da Gratão Uniformes.
            </p>
          </div>
        </Card>
      </section>
    </main>
  );
}
