from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.employees import (
    calculate_employee_work_log,
    ensure_work_log_can_change,
    ensure_work_log_does_not_overlap,
    open_employee_work_log_values,
    recalculate_employee_work_day,
)
from app.db.session import get_db
from app.models.employee import Employee, EmployeeWorkLog
from app.models.enums import EmployeePaymentStatus
from app.models.user import User
from app.models.weekly_closing import WeeklyClosing
from app.schemas.employee import WorkLogClockOut, WorkLogRead, WorkLogUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])
MONEY_QUANTIZER = Decimal("0.01")


@router.get("", response_model=list[WorkLogRead])
def list_work_logs(db: Annotated[Session, Depends(get_db)]) -> list[EmployeeWorkLog]:
    query = select(EmployeeWorkLog).order_by(
        EmployeeWorkLog.work_date.desc(),
        EmployeeWorkLog.id.desc(),
    )
    return list(db.scalars(query))


@router.post("/{work_log_id}/pay", response_model=WorkLogRead)
def pay_work_log(
    work_log_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeWorkLog:
    work_log = _get_work_log_or_404(db, work_log_id)
    ensure_work_log_can_change(work_log, db)
    if work_log.clock_out is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registre a hora de saida antes de marcar como pago.",
        )

    work_log.payment_status = EmployeePaymentStatus.PAID
    work_log.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(work_log)
    return work_log


@router.patch("/{work_log_id}", response_model=WorkLogRead)
def update_work_log(
    work_log_id: int,
    payload: WorkLogUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmployeeWorkLog:
    work_log = _get_work_log_or_404(db, work_log_id)
    _ensure_admin_can_correct(current_user)
    employee = db.get(Employee, work_log.employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee not found",
        )

    provided_fields = payload.model_fields_set
    old_work_date = work_log.work_date
    new_work_date = payload.work_date if "work_date" in provided_fields and payload.work_date else old_work_date
    closing = db.get(WeeklyClosing, work_log.weekly_closing_id) if work_log.weekly_closing_id else None
    if closing is not None and not (closing.start_date <= new_work_date <= closing.end_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data corrigida precisa permanecer dentro do periodo do fechamento semanal.",
        )
    work_log.work_date = new_work_date

    clock_in = payload.clock_in if "clock_in" in provided_fields else work_log.clock_in
    clock_out = payload.clock_out if "clock_out" in provided_fields else work_log.clock_out
    if clock_in is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hora de entrada e obrigatoria.",
        )

    break_hours = payload.break_hours if payload.break_hours is not None else work_log.break_hours
    payment_mode = payload.payment_mode if "payment_mode" in provided_fields and payload.payment_mode else work_log.payment_mode
    ensure_work_log_does_not_overlap(
        db=db,
        employee_id=work_log.employee_id,
        work_date=new_work_date,
        clock_in=clock_in,
        clock_out=clock_out,
        exclude_work_log_id=work_log.id,
    )
    if clock_out is None:
        calculated = open_employee_work_log_values(
            clock_in=clock_in,
            break_hours=break_hours,
            payment_mode=payment_mode,
        )
    else:
        calculated = calculate_employee_work_log(
            employee=employee,
            clock_in=clock_in,
            clock_out=clock_out,
            break_hours=break_hours,
            payment_mode=payment_mode,
        )
    if payload.total_amount is not None:
        _apply_manual_total(calculated, payload.total_amount)
    for field, value in calculated.items():
        setattr(work_log, field, value)
    if "notes" in provided_fields:
        work_log.notes = payload.notes

    if payload.total_amount is None:
        recalculate_employee_work_day(db, employee, new_work_date)
        if new_work_date != old_work_date:
            recalculate_employee_work_day(db, employee, old_work_date)
    if closing is not None:
        _refresh_weekly_closing_employee_totals(closing)

    db.commit()
    db.refresh(work_log)
    return work_log


@router.post("/{work_log_id}/clock-out", response_model=WorkLogRead)
def clock_out_work_log(
    work_log_id: int,
    payload: WorkLogClockOut,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeWorkLog:
    work_log = _get_work_log_or_404(db, work_log_id)
    ensure_work_log_can_change(work_log, db)
    if work_log.clock_out is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este registro ja possui hora de saida.",
        )
    if work_log.clock_in is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este registro nao possui hora de entrada.",
        )

    employee = db.get(Employee, work_log.employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee not found",
        )

    ensure_work_log_does_not_overlap(
        db=db,
        employee_id=work_log.employee_id,
        work_date=work_log.work_date,
        clock_in=work_log.clock_in,
        clock_out=payload.clock_out,
        exclude_work_log_id=work_log.id,
    )
    calculated = calculate_employee_work_log(
        employee=employee,
        clock_in=work_log.clock_in,
        clock_out=payload.clock_out,
        break_hours=payload.break_hours if payload.break_hours is not None else work_log.break_hours,
        payment_mode=payload.payment_mode or work_log.payment_mode,
    )
    for field, value in calculated.items():
        setattr(work_log, field, value)
    if payload.notes is not None:
        work_log.notes = payload.notes

    recalculate_employee_work_day(db, employee, work_log.work_date)
    db.commit()
    db.refresh(work_log)
    return work_log


@router.delete("/{work_log_id}", status_code=204)
def delete_work_log(
    work_log_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    work_log = _get_work_log_or_404(db, work_log_id)
    ensure_work_log_can_change(work_log, db)
    employee = db.get(Employee, work_log.employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee not found",
        )
    work_date = work_log.work_date
    closing = db.get(WeeklyClosing, work_log.weekly_closing_id) if work_log.weekly_closing_id else None
    db.delete(work_log)
    db.flush()
    recalculate_employee_work_day(db, employee, work_date)
    if closing is not None:
        _refresh_weekly_closing_employee_totals(closing)
    db.commit()


def _get_work_log_or_404(db: Session, work_log_id: int) -> EmployeeWorkLog:
    work_log = db.get(EmployeeWorkLog, work_log_id)
    if work_log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work log not found",
        )
    return work_log


def _ensure_admin_can_correct(current_user: User) -> None:
    if current_user.role != "admin" and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas usuarios admin podem corrigir registros de ponto.",
        )


def _apply_manual_total(calculated: dict, total_amount: Decimal) -> None:
    total = _money(total_amount)
    overtime = _money(calculated.get("overtime_amount", Decimal("0.00")))
    if overtime > total:
        overtime = Decimal("0.00")
    base = _money(total - overtime)
    calculated["base_amount"] = base
    calculated["overtime_amount"] = overtime
    calculated["total_amount"] = total
    calculated["amount"] = total


def _refresh_weekly_closing_employee_totals(closing: WeeklyClosing) -> None:
    work_logs = list(closing.work_logs)
    total_base = _sum_money(log.base_amount for log in work_logs)
    total_overtime = _sum_money(log.overtime_amount for log in work_logs)
    closing.days_worked = len({log.work_date for log in work_logs if log.net_hours > 0})
    closing.total_gross_hours = _sum_hours(log.gross_hours for log in work_logs)
    closing.total_break_hours = _sum_hours(log.break_hours for log in work_logs)
    closing.total_net_hours = _sum_hours(log.net_hours for log in work_logs)
    closing.total_regular_hours = _sum_hours(log.regular_hours for log in work_logs)
    closing.total_overtime_hours = _sum_hours(log.overtime_hours for log in work_logs)
    closing.total_base_amount = total_base
    closing.total_overtime_amount = total_overtime
    closing.total_payable = _money(total_base + total_overtime - closing.discounts - closing.advances)


def _sum_money(values) -> Decimal:
    return _money(sum((Decimal(value or 0) for value in values), Decimal("0")))


def _sum_hours(values) -> Decimal:
    return _money(sum((Decimal(value or 0) for value in values), Decimal("0")))


def _money(value: Decimal | int | None) -> Decimal:
    return Decimal(value or 0).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)
