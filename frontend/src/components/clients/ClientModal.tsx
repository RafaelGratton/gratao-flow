"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Client, ClientCreatePayload, ClientUpdatePayload } from "./types";

const clientSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cliente."),
  phone: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  type: z
    .string()
    .optional()
    .transform((value) => value?.trim() || "regular"),
  notes: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  is_active: z.boolean().default(true)
});

type ClientFormInput = {
  name: string;
  phone: string;
  type: string;
  notes: string;
  is_active: boolean;
};

type ClientModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (client: Client) => void;
  client?: Client | null;
  title?: string;
};

export function ClientModal({
  open,
  onClose,
  onSaved,
  client,
  title
}: ClientModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<ClientFormInput>({
    resolver: zodResolver(clientSchema) as Resolver<ClientFormInput>,
    defaultValues: {
      name: "",
      phone: "",
      type: "regular",
      notes: "",
      is_active: true
    }
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      type: client?.type ?? "regular",
      notes: client?.notes ?? "",
      is_active: client?.is_active ?? true
    });
  }, [client, open, reset]);

  if (!open) return null;

  const modalTitle = title ?? (client ? "Editar cliente" : "Novo cliente");

  function closeAndReset() {
    reset();
    onClose();
  }

  async function onSubmit(rawValues: ClientFormInput) {
    const values = clientSchema.parse(rawValues);
    const payload: ClientCreatePayload | ClientUpdatePayload = {
      name: values.name,
      phone: values.phone,
      type: values.type,
      notes: values.notes ? values.notes : null,
      is_active: values.is_active
    };

    try {
      const savedClient = client
        ? await api.put<Client>(`/clients/${client.id}`, payload)
        : await api.post<Client>("/clients", payload);
      reset();
      onSaved(savedClient);
      onClose();
    } catch (requestError) {
      setError("root", {
        message:
          requestError instanceof Error
            ? requestError.message
            : "Nao foi possivel salvar o cliente."
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-nav/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg border border-line bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
              Clientes
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">{modalTitle}</h2>
          </div>
          <button
            type="button"
            onClick={closeAndReset}
            className="grid h-10 w-10 place-items-center rounded-md text-muted transition hover:bg-[#FCFAF6] hover:text-ink focus-visible:focus-ring"
            aria-label="Fechar modal"
            disabled={isSubmitting}
          >
            <X size={18} />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={handleSubmit(onSubmit)}>
          {errors.root?.message ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {errors.root.message}
            </div>
          ) : null}

          <Input
            label="Nome"
            placeholder="Ex: Cliente Teste Frontend"
            error={errors.name?.message}
            {...register("name")}
            defaultValue={client?.name ?? ""}
          />
          <Input
            label="Telefone"
            placeholder="Ex: 61999999999"
            error={errors.phone?.message}
            {...register("phone")}
            defaultValue={client?.phone ?? ""}
          />
          <Input
            label="Tipo"
            placeholder="Ex: regular"
            {...register("type")}
            defaultValue={client?.type ?? "regular"}
          />

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Observacoes</span>
            <textarea
              className={cn(
                "min-h-28 w-full rounded-md border border-line bg-white px-3 py-3 text-sm text-ink shadow-insetline transition placeholder:text-muted/70 focus:focus-ring",
                errors.notes && "border-danger/60 ring-2 ring-danger/10"
              )}
              placeholder="Detalhes simples para identificar o cliente"
              {...register("notes")}
              defaultValue={client?.notes ?? ""}
            />
            {errors.notes?.message ? (
              <span className="block text-xs font-medium text-danger">
                {errors.notes.message}
              </span>
            ) : null}
          </label>

          <label className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-accent focus:focus-ring"
              {...register("is_active")}
              defaultChecked={client?.is_active ?? true}
            />
            Cliente ativo
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeAndReset} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <Check size={18} />
              Salvar cliente
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
