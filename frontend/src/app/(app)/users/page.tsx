"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Pencil, Plus, UserX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiError, api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type UserRole = "admin" | "operator";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
};

const emptyForm: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "operator",
  is_active: true
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<User[]>("/users");
      setUsers(data);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 403) {
        setError("Você não tem permissão para gerenciar usuários.");
      } else {
        setError(
          requestError instanceof Error ? requestError.message : "Nao foi possivel carregar usuarios."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const summary = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.role === "admin" || user.is_admin).length,
      operators: users.filter((user) => user.role === "operator" && !user.is_admin).length,
      inactive: users.filter((user) => !user.is_active).length
    }),
    [users]
  );

  function handleSaved(user: User, message: string) {
    setUsers((current) => [user, ...current.filter((item) => item.id !== user.id)]);
    setFeedback(message);
    setModalOpen(false);
    setEditingUser(null);
  }

  async function handleDeactivate(user: User) {
    const confirmed = window.confirm("Deseja desativar este usuario?");
    if (!confirmed) return;

    setError(null);
    setFeedback(null);
    try {
      const updated = await api.delete<User>(`/users/${user.id}`);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setFeedback("Usuario desativado com sucesso.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Nao foi possivel desativar usuario."
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">
            Gratão Flow
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">Usuários</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Controle de acesso ao Gratão Flow</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingUser(null);
            setModalOpen(true);
          }}
        >
          <Plus size={17} />
          Novo usuário
        </Button>
      </div>

      {feedback ? (
        <div className="rounded-md border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">
          {feedback}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total de usuários" value={summary.total} />
        <SummaryCard label="Administradores" value={summary.admins} />
        <SummaryCard label="Operadores" value={summary.operators} />
        <SummaryCard label="Inativos" value={summary.inactive} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line/70 px-5 py-4">
          <h2 className="text-lg font-black text-ink">Acessos cadastrados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-canvas text-xs font-bold uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Papel</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Criado em</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-muted" colSpan={6}>
                    Carregando usuários...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-muted" colSpan={6}>
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="bg-white">
                    <td className="px-5 py-4 font-semibold text-ink">{user.name}</td>
                    <td className="px-5 py-4 text-muted">{user.email}</td>
                    <td className="px-5 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          user.is_active
                            ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success"
                            : "rounded-full bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger"
                        }
                      >
                        {user.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted">{formatDateTime(user.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 px-3"
                          onClick={() => {
                            setEditingUser(user);
                            setModalOpen(true);
                          }}
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 px-3"
                          onClick={() => setPasswordUser(user)}
                          title="Alterar senha"
                        >
                          <KeyRound size={15} />
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="h-9 px-3"
                          onClick={() => void handleDeactivate(user)}
                          title="Desativar"
                          disabled={!user.is_active}
                        >
                          <UserX size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <UserModal
        open={modalOpen}
        user={editingUser}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        onSaved={handleSaved}
        onError={setError}
      />
      <PasswordModal
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
        onSaved={() => {
          setPasswordUser(null);
          setFeedback("Senha alterada com sucesso.");
        }}
        onError={setError}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 text-3xl font-black text-ink">{value}</p>
    </Card>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-dark">
      {role === "admin" ? "Admin" : "Operador"}
    </span>
  );
}

function UserModal({
  open,
  user,
  onClose,
  onSaved,
  onError
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: (user: User, message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      user
        ? {
            name: user.name,
            email: user.email,
            password: "",
            role: user.role,
            is_active: user.is_active
          }
        : emptyForm
    );
  }, [open, user]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError(null);
    try {
      const saved = user
        ? await api.put<User>(`/users/${user.id}`, {
            name: form.name,
            email: form.email,
            role: form.role,
            is_active: form.is_active
          })
        : await api.post<User>("/users", form);
      onSaved(saved, user ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.");
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Nao foi possivel salvar usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <Card className="w-full max-w-xl p-5">
        <h2 className="text-xl font-black text-ink">
          {user ? "Editar usuário" : "Criar usuário"}
        </h2>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Nome"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
          {!user ? (
            <Input
              label="Senha"
              type="password"
              minLength={8}
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              required
            />
          ) : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-ink">Papel</span>
            <select
              className="h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition focus:focus-ring"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as UserRole }))
              }
            >
              <option value="admin">Admin</option>
              <option value="operator">Operador</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-md border border-line bg-white p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm((current) => ({ ...current, is_active: event.target.checked }))
              }
              className="h-4 w-4"
            />
            Ativo
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              Salvar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function PasswordModal({
  user,
  onClose,
  onSaved,
  onError
}: {
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setNewPassword("");
    }
  }, [user]);

  if (!user) return null;
  const activeUser = user;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError(null);
    try {
      await api.post<User>(`/users/${activeUser.id}/change-password`, { new_password: newPassword });
      onSaved();
    } catch (requestError) {
      onError(requestError instanceof Error ? requestError.message : "Nao foi possivel alterar senha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <Card className="w-full max-w-md p-5">
        <h2 className="text-xl font-black text-ink">Alterar senha</h2>
        <p className="mt-2 text-sm text-muted">{activeUser.name}</p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Nova senha"
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              Alterar senha
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
