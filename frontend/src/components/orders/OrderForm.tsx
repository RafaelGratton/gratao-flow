"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SelectHTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";
import { Controller, type Resolver, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { ClientSelect } from "@/components/clients/ClientSelect";
import type { Client } from "@/components/clients/types";
import type { CatalogItem, OrderDetails, SewingMode } from "@/components/orders/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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

const itemSchema = z.object({
  product_id: requiredSelectNumber("Selecione um produto"),
  size_id: requiredSelectNumber("Selecione um tamanho"),
  color: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? ""),
  quantity_requested: z.coerce.number().int().positive("Informe uma quantidade valida."),
  sewing_mode: z.enum(["internal", "outsourced"]).nullable().optional(),
  service_ids: z
    .array(z.coerce.number().int().positive())
    .min(1, "Selecione pelo menos um servico."),
  notes: z.string().optional()
});

const schema = z.object({
  client_id: requiredSelectNumber("Selecione um cliente"),
  items: z.array(itemSchema).min(1, "Adicione pelo menos um item."),
  allow_printing_exception: z.boolean().default(false),
  notes: z.string().optional()
});

type FormInput = {
  client_id: string;
  items: Array<{
    product_id: string;
    size_id: string;
    color: string;
    quantity_requested: number;
    sewing_mode: SewingMode | null;
    service_ids: number[];
    notes: string;
  }>;
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

const emptyItem = () => ({
  product_id: "",
  size_id: "",
  color: "",
  quantity_requested: 1,
  sewing_mode: null as SewingMode | null,
  service_ids: [],
  notes: ""
});

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
      items: [emptyItem()],
      allow_printing_exception: false,
      notes: ""
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const watchedItems = watch("items") ?? [];

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
    return watchedItems.reduce((orderTotal, item) => {
      const quantity = Number(item.quantity_requested || 0);
      const itemTotal = catalogs.services
        .filter((service) => item.service_ids.includes(service.id))
        .reduce(
          (total, service) => total + Number(service.price_per_unit ?? 0) * quantity,
          0
        );
      return orderTotal + itemTotal;
    }, 0);
  }, [catalogs.services, watchedItems]);

  async function onSubmit(rawValues: FormInput) {
    setSubmitError(null);
    const values = schema.parse(rawValues);
    if (!catalogs.clients.some((client) => client.id === values.client_id)) {
      setSubmitError("Selecione um cliente valido.");
      return;
    }

    try {
      const order = await api.post<OrderDetails>("/orders", {
        client_id: values.client_id,
        allow_printing_exception: values.allow_printing_exception,
        notes: values.notes?.trim() ? values.notes : null,
        items: values.items.map((item) => ({
          product_id: item.product_id,
          size_id: item.size_id,
          color: item.color,
          quantity_requested: item.quantity_requested,
          sewing_mode: itemHasSewingService(item.service_ids) ? item.sewing_mode ?? "internal" : null,
          notes: item.notes?.trim() ? item.notes : null,
          service_ids: item.service_ids.map(Number)
        }))
      });
      router.push(`/orders/${order.id}`);
    } catch (requestError) {
      setSubmitError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel criar a OS."
      );
    }
  }

  function toggleService(itemIndex: number, serviceId: number) {
    const fieldName = `items.${itemIndex}.service_ids` as const;
    const selectedServices = watch(fieldName) ?? [];
    const removing = selectedServices.includes(serviceId);
    const next = removing
      ? selectedServices.filter((id) => id !== serviceId)
      : [...selectedServices, serviceId];
    setValue(fieldName, next, { shouldDirty: true, shouldValidate: true });

    const toggledService = catalogs.services.find((service) => service.id === serviceId);
    if (toggledService?.type !== "confeccao") return;
    setValue(
      `items.${itemIndex}.sewing_mode`,
      removing ? null : "internal",
      { shouldDirty: true, shouldValidate: true }
    );
  }

  function itemHasSewingService(serviceIds: number[]) {
    return serviceIds.some((serviceId) =>
      catalogs.services.some((service) => service.id === serviceId && service.type === "confeccao")
    );
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
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-3 rounded-md border border-line bg-[#FCFAF6] p-4 text-sm font-semibold text-muted">
              <Loader2 className="animate-spin" size={18} />
              Carregando catalogos...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
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
              <Input
                label="Observacoes gerais"
                error={errors.notes?.message}
                placeholder="Opcional"
                {...register("notes")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-ink">Itens</h2>
          <Button type="button" variant="secondary" onClick={() => append(emptyItem())}>
            <Plus size={18} />
            Adicionar item
          </Button>
        </div>

        {fields.map((field, index) => {
          const selectedServices = watchedItems[index]?.service_ids ?? [];
          const hasSewing = itemHasSewingService(selectedServices);
          const itemErrors = errors.items?.[index];
          return (
            <Card key={field.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-black text-ink">Item {index + 1}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger hover:text-danger"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 size={18} />
                    Remover
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Controller
                    control={control}
                    name={`items.${index}.product_id`}
                    render={({ field: productField }) => (
                      <SelectField
                        label="Produto"
                        name={productField.name}
                        value={String(productField.value ?? "")}
                        onBlur={productField.onBlur}
                        onChange={(event) => productField.onChange(event.target.value)}
                        error={itemErrors?.product_id?.message}
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
                    name={`items.${index}.size_id`}
                    render={({ field: sizeField }) => (
                      <SelectField
                        label="Tamanho"
                        name={sizeField.name}
                        value={String(sizeField.value ?? "")}
                        onBlur={sizeField.onBlur}
                        onChange={(event) => sizeField.onChange(event.target.value)}
                        error={itemErrors?.size_id?.message}
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
                  <Input
                    label="Cor"
                    error={itemErrors?.color?.message}
                    placeholder="Ex: Azul marinho"
                    {...register(`items.${index}.color`)}
                  />
                  <Input
                    label="Quantidade"
                    type="number"
                    min={1}
                    error={itemErrors?.quantity_requested?.message}
                    {...register(`items.${index}.quantity_requested`)}
                  />
                </div>

                <Input
                  label="Observacoes do item"
                  error={itemErrors?.notes?.message}
                  placeholder="Opcional"
                  {...register(`items.${index}.notes`)}
                />

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {catalogs.services.map((service) => {
                    const active = selectedServices.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(index, service.id)}
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
                {itemErrors?.service_ids?.message ? (
                  <p className="text-xs font-semibold text-danger">
                    {itemErrors.service_ids.message}
                  </p>
                ) : null}

                {hasSewing ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-ink">Tipo de confeccao</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        ["internal", "Interna"],
                        ["outsourced", "Terceirizada"]
                      ].map(([value, label]) => (
                        <label
                          key={value}
                          className={cn(
                            "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-semibold transition",
                            (watchedItems[index]?.sewing_mode ?? "internal") === value
                              ? "border-accent bg-accent-soft text-ink shadow-insetline"
                              : "border-line bg-white text-muted hover:bg-[#FCFAF6]"
                          )}
                        >
                          <input
                            type="radio"
                            className="h-4 w-4 border-line text-accent focus:focus-ring"
                            value={value}
                            {...register(`items.${index}.sewing_mode`)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {itemErrors?.sewing_mode?.message ? (
                      <p className="text-xs font-semibold text-danger">
                        {itemErrors.sewing_mode.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
