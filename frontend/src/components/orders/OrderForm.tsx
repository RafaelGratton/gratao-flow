"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SelectHTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import { ClientSelect } from "@/components/clients/ClientSelect";
import type { Client } from "@/components/clients/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { CatalogItem, OrderDetails } from "@/components/orders/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const requiredSelectNumber = (message: string) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    },
    z
      .number({ required_error: message, invalid_type_error: message })
      .int(message)
      .positive(message)
  );

const schema = z.object({
  client_id: requiredSelectNumber("Selecione um cliente"),
  product_id: requiredSelectNumber("Selecione um produto"),
  size_id: requiredSelectNumber("Selecione um tamanho"),
  color: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  quantity_requested: z.coerce.number().int().positive("Informe uma quantidade valida."),
  lot: z.string().min(1, "Informe o lote."),
  service_ids: z
    .array(z.coerce.number().int().positive())
    .min(1, "Selecione pelo menos um serviço."),
  allow_printing_exception: z.boolean().default(false),
  notes: z.string().optional()
});

type FormValues = z.output<typeof schema>;
type FormInput = {
  client_id: string;
  product_id: string;
  size_id: string;
  color: string;
  quantity_requested: number;
  lot: string;
  service_ids: number[];
  allow_printing_exception: boolean;
  notes: string;
};

type CatalogData = {
  clients: Client[];
  products: CatalogItem[];
  sizes: CatalogItem[];
  services: CatalogItem[];
};

const initialData: CatalogData = {
  clients: [],
  products: [],
  sizes: [],
  services: []
};

export function OrderForm() {
  const router = useRouter();
  const [catalogs, setCatalogs] = useState<CatalogData>(initialData);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FormInput>({
    resolver: zodResolver(schema) as Resolver<FormInput>,
    defaultValues: {
      client_id: "",
      product_id: "",
      size_id: "",
      color: "",
      quantity_requested: 1,
      lot: "",
      service_ids: [],
      allow_printing_exception: false,
      notes: ""
    }
  });

  const selectedServices = watch("service_ids") ?? [];
  const quantity = watch("quantity_requested");

  useEffect(() => {
    let active = true;

    async function loadCatalogs() {
      setLoading(true);
      setSubmitError(null);
      try {
        const [clients, products, sizes, services] = await Promise.all([
          api.get<Client[]>("/clients"),
          api.get<CatalogItem[]>("/products"),
          api.get<CatalogItem[]>("/sizes"),
          api.get<CatalogItem[]>("/services")
        ]);

        if (active) {
          setCatalogs({
            clients: clients.filter((client) => client.is_active),
            products,
            sizes,
            services: services.filter((service) => service.is_active !== false)
          });
        }
      } catch (requestError) {
        if (active) {
          setSubmitError(
            requestError instanceof Error
              ? requestError.message
              : "Nao foi possivel carregar os dados do formulario."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCatalogs();

    return () => {
      active = false;
    };
  }, []);

  const estimatedTotal = useMemo(() => {
    return catalogs.services
      .filter((service) => selectedServices.includes(service.id))
      .reduce((total, service) => total + Number(service.price_per_unit ?? 0) * Number(quantity || 0), 0);
  }, [catalogs.services, quantity, selectedServices]);

  async function onSubmit(rawValues: FormInput) {
    setSubmitError(null);
    const values = schema.parse(rawValues);
    if (!catalogs.clients.some((client) => client.id === values.client_id)) {
      setSubmitError("Selecione um cliente valido.");
      return;
    }

    const serviceIds = values.service_ids.map(Number);
    if (serviceIds.some((serviceId) => !Number.isFinite(serviceId))) {
      setSubmitError("Selecione serviços válidos.");
      return;
    }

    try {
      const order = await api.post<OrderDetails>("/orders", {
        client_id: values.client_id,
        product_id: values.product_id,
        size_id: values.size_id,
        color: values.color,
        quantity_requested: values.quantity_requested,
        allow_printing_exception: values.allow_printing_exception,
        lot: values.lot,
        notes: values.notes?.trim() ? values.notes : null,
        service_ids: serviceIds
      });
      router.push(`/orders/${order.id}`);
    } catch (requestError) {
      setSubmitError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel criar a OS."
      );
    }
  }

  function toggleService(serviceId: number) {
    const next = selectedServices.includes(serviceId)
      ? selectedServices.filter((id) => id !== serviceId)
      : [...selectedServices, serviceId];
    setValue("service_ids", next, { shouldDirty: true, shouldValidate: true });
  }

  function handleClientCreated(client: Client) {
    setCatalogs((current) => ({
      ...current,
      clients: [client, ...current.clients.filter((item) => item.id !== client.id)]
    }));
    setValue("client_id", String(client.id), { shouldDirty: true, shouldValidate: true });
    setFeedback("Cliente criado e selecionado.");
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Nova ordem
          </p>
          <h1 className="mt-1 text-2xl font-black text-ink">Criar OS</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/orders">
            <Button type="button" variant="secondary">
              <ArrowLeft size={18} />
              Voltar
            </Button>
          </Link>
          <Button type="submit" isLoading={isSubmitting} disabled={loading}>
            <Check size={18} />
            Criar OS
          </Button>
        </div>
      </div>

      {submitError ? (
        <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {submitError}
        </div>
      ) : null}
      {feedback ? (
        <div className="rounded-md border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">
          {feedback}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-black text-ink">Dados da OS</h2>
          <p className="mt-1 text-sm text-muted">Uma OS deve conter apenas um produto.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-4 text-sm font-semibold text-muted">
              <Loader2 className="animate-spin" size={18} />
              Carregando catalogos...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Controller
                control={control}
                name="client_id"
                render={({ field }) => (
                  <ClientSelect
                    clients={catalogs.clients}
                    name={field.name}
                    value={String(field.value ?? "")}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.value)}
                    error={errors.client_id?.message}
                    onClientCreated={handleClientCreated}
                  />
                )}
              />
              <Controller
                control={control}
                name="product_id"
                render={({ field }) => (
                  <SelectField
                    label="Produto"
                    name={field.name}
                    value={String(field.value ?? "")}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.value)}
                    error={errors.product_id?.message}
                  >
                    <option value="">Selecione...</option>
                    {catalogs.products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </SelectField>
                )}
              />
              <Controller
                control={control}
                name="size_id"
                render={({ field }) => (
                  <SelectField
                    label="Tamanho"
                    name={field.name}
                    value={String(field.value ?? "")}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.value)}
                    error={errors.size_id?.message}
                  >
                    <option value="">Selecione...</option>
                    {catalogs.sizes.map((size) => (
                      <option key={size.id} value={size.id}>
                        {size.label}
                      </option>
                    ))}
                  </SelectField>
                )}
              />
              <Input label="Cor" error={errors.color?.message} placeholder="Ex: Azul marinho" {...register("color")} />
              <Input
                label="Quantidade"
                type="number"
                min={1}
                error={errors.quantity_requested?.message}
                {...register("quantity_requested")}
              />
              <Input label="Lote" error={errors.lot?.message} placeholder="Ex: MAI-001" {...register("lot")} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-black text-ink">Serviços</h2>
          <p className="mt-1 text-sm text-muted">Os valores sao congelados pelo backend ao criar a OS.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {catalogs.services.map((service) => {
              const active = selectedServices.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition focus-visible:focus-ring",
                    active
                      ? "border-accent bg-accent-soft text-ink shadow-insetline"
                      : "border-line bg-white hover:bg-[#FCFAF6]"
                  )}
                >
                  <span className="text-sm font-black">{service.name}</span>
                  <span className="mt-2 block text-xs font-semibold text-muted">
                    R$ {Number(service.price_per_unit ?? 0).toFixed(2).replace(".", ",")} por peca
                  </span>
                </button>
              );
            })}
          </div>
          {errors.service_ids?.message ? (
            <p className="mt-3 text-xs font-semibold text-danger">{errors.service_ids.message}</p>
          ) : null}
          <div className="mt-5 flex flex-col gap-4 rounded-md border border-line bg-[#FCFAF6] p-4 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-line text-accent focus:focus-ring"
                {...register("allow_printing_exception")}
              />
              Permitir excecao de serigrafia
            </label>
            <p className="text-sm font-black text-ink">
              Total estimado: R$ {estimatedTotal.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
};

function SelectField({ label, error, className, children, ...props }: SelectProps) {
  const inputId = props.id ?? props.name;
  return (
    <label className="block space-y-2" htmlFor={inputId}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select
        id={inputId}
        className={cn(
          "h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring",
          error && "border-danger/60 ring-2 ring-danger/10",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="block text-xs font-medium text-danger">{error}</span> : null}
    </label>
  );
}
