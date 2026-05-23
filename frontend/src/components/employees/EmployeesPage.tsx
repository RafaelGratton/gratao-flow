"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmployeeModal } from "@/components/employees/EmployeeModal";
import { EmployeeSummaryCards } from "@/components/employees/EmployeeSummaryCards";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { WorkLogExitModal } from "@/components/employees/WorkLogExitModal";
import { WorkLogModal } from "@/components/employees/WorkLogModal";
import { WorkLogsTable } from "@/components/employees/WorkLogsTable";
import type { Employee, WorkLog } from "@/components/employees/types";
import { WeeklyClosingCreateModal } from "@/components/weekly-closings/WeeklyClosingCreateModal";
import type { WeeklyClosing } from "@/components/weekly-closings/types";
import { api } from "@/lib/api";

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [workLogEmployee, setWorkLogEmployee] = useState<Employee | null>(null);
  const [exitingWorkLog, setExitingWorkLog] = useState<WorkLog | null>(null);
  const [closingEmployee, setClosingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [employeeList, logList] = await Promise.all([
        api.get<Employee[]>("/employees"),
        api.get<WorkLog[]>("/work-logs")
      ]);
      setEmployees(employeeList);
      setWorkLogs(logList);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar funcionarios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleWorkLogs = useMemo(
    () =>
      selectedEmployee
        ? workLogs.filter((workLog) => workLog.employee_id === selectedEmployee.id)
        : workLogs,
    [selectedEmployee, workLogs]
  );

  function handleEmployeeSaved(employee: Employee) {
    setEmployees((current) => [employee, ...current.filter((item) => item.id !== employee.id)]);
    setFeedback(editingEmployee ? "Funcionario atualizado com sucesso." : "Funcionario criado com sucesso.");
  }

  function handleWorkLogCreated(workLog: WorkLog) {
    setWorkLogs((current) => [workLog, ...current.filter((item) => item.id !== workLog.id)]);
    setFeedback("Entrada registrada com sucesso.");
  }

  function handleWorkLogSaved(workLog: WorkLog) {
    setWorkLogs((current) => current.map((item) => (item.id === workLog.id ? workLog : item)));
    setFeedback("Saida registrada e diaria calculada.");
  }

  function handleWeeklyClosingCreated(_closing: WeeklyClosing) {
    setFeedback("Fechamento semanal criado com sucesso.");
    void load();
  }

  const exitingEmployee = exitingWorkLog
    ? employees.find((employee) => employee.id === exitingWorkLog.employee_id) ?? null
    : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-dark">Gratao Flow</p>
        <h1 className="mt-1 text-3xl font-black text-ink">Funcionarios</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Diarias, ponto diario e horas extras</p>
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

      <EmployeeSummaryCards employees={employees} workLogs={workLogs} />
      <EmployeeTable
        employees={employees}
        loading={loading}
        onCreate={() => {
          setEditingEmployee(null);
          setEmployeeModalOpen(true);
        }}
        onEdit={(employee) => {
          setEditingEmployee(employee);
          setEmployeeModalOpen(true);
        }}
        onRegisterDay={setWorkLogEmployee}
        onCloseWeek={setClosingEmployee}
        onViewLogs={setSelectedEmployee}
      />
      <WorkLogsTable
        employees={employees}
        workLogs={visibleWorkLogs}
        loading={loading}
        selectedEmployee={selectedEmployee}
        onRegisterExit={setExitingWorkLog}
        onClearFilter={() => setSelectedEmployee(null)}
      />

      <EmployeeModal
        open={employeeModalOpen}
        employee={editingEmployee}
        onClose={() => {
          setEmployeeModalOpen(false);
          setEditingEmployee(null);
        }}
        onSaved={handleEmployeeSaved}
      />
      <WorkLogModal
        employee={workLogEmployee}
        onClose={() => setWorkLogEmployee(null)}
        onCreated={handleWorkLogCreated}
      />
      <WorkLogExitModal
        workLog={exitingWorkLog}
        employee={exitingEmployee}
        onClose={() => setExitingWorkLog(null)}
        onSaved={handleWorkLogSaved}
      />
      <WeeklyClosingCreateModal
        open={closingEmployee !== null}
        employees={employees}
        workLogs={workLogs}
        initialEmployeeId={closingEmployee?.id ?? null}
        onClose={() => setClosingEmployee(null)}
        onCreated={handleWeeklyClosingCreated}
      />
    </div>
  );
}
