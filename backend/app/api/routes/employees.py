from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.employee import Employee, EmployeeWorkLog
from app.models.enums import EmployeePaymentStatus, WeeklyClosingStatus, WorkPaymentMode, WorkType
from app.models.user import User
from app.models.weekly_closing import WeeklyClosing
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeRead,
    EmployeeUpdate,
    WorkLogCreate,
    WorkLogRead,
)

router = APIRouter(dependencies=[Depends(get_current_user)])

MONEY_QUANTIZER = Decimal("0.01")
HOUR_QUANTIZER = Decimal("0.01")


@router.post("", response_model=EmployeeRead, status_code=201)
def create_employee(
    payload: EmployeeCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Employee:
    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.get("", response_model=list[EmployeeRead])
def list_employees(db: Annotated[Session, Depends(get_db)]) -> list[Employee]:
    return list(db.scalars(select(Employee).order_by(Employee.name)))


@router.get("/{employee_id}", response_model=EmployeeRead)
def get_employee(employee_id: int, db: Annotated[Session, Depends(get_db)]) -> Employee:
    return _get_employee_or_404(db, employee_id)


@router.put("/{employee_id}", response_model=EmployeeRead)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> Employee:
    employee = _get_employee_or_404(db, employee_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return employee


@router.post("/{employee_id}/work-logs", response_model=WorkLogRead, status_code=201)
def create_employee_work_log(
    employee_id: int,
    payload: WorkLogCreate,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeWorkLog:
    employee = _get_employee_or_404(db, employee_id)
    _ensure_work_log_does_not_exist(db, employee.id, payload.work_date)

    calculated = _calculate_work_log(
        employee=employee,
        clock_in=payload.clock_in,
        clock_out=payload.clock_out,
        break_hours=payload.break_hours,
        payment_mode=payload.payment_mode,
    )
    work_log = EmployeeWorkLog(
        employee_id=employee.id,
        work_date=payload.work_date,
        notes=payload.notes,
        payment_status=EmployeePaymentStatus.PENDING,
        **calculated,
    )
    db.add(work_log)
    db.commit()
    db.refresh(work_log)
    return work_log


@router.get("/{employee_id}/work-logs", response_model=list[WorkLogRead])
def list_employee_work_logs(
    employee_id: int,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[EmployeeWorkLog]:
    _get_employee_or_404(db, employee_id)
    query = select(EmployeeWorkLog).where(EmployeeWorkLog.employee_id == employee_id)
    query = _apply_date_filters(query, start_date, end_date)
    query = query.order_by(EmployeeWorkLog.work_date.desc(), EmployeeWorkLog.id.desc())
    return list(db.scalars(query))


def calculate_employee_work_log(
    employee: Employee,
    clock_in: time,
    clock_out: time,
    break_hours: Decimal,
    payment_mode: WorkPaymentMode,
) -> dict[str, Decimal | WorkPaymentMode | WorkType | time]:
    return _calculate_work_log(employee, clock_in, clock_out, break_hours, payment_mode)


def _get_employee_or_404(db: Session, employee_id: int) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


def _ensure_work_log_does_not_exist(db: Session, employee_id: int, work_date: date) -> None:
    existing_id = db.scalar(
        select(EmployeeWorkLog.id).where(
            EmployeeWorkLog.employee_id == employee_id,
            EmployeeWorkLog.work_date == work_date,
        )
    )
    if existing_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee already has a work log for this date",
        )


def _calculate_work_log(
    employee: Employee,
    clock_in: time,
    clock_out: time,
    break_hours: Decimal,
    payment_mode: WorkPaymentMode,
) -> dict[str, Decimal | WorkPaymentMode | WorkType | time]:
    gross_hours = _time_delta_hours(clock_in, clock_out)
    if break_hours > gross_hours:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Intervalo nao pode ser maior que as horas brutas.",
        )

    net_hours = _hours(gross_hours - break_hours)
    regular_hours = _hours(min(net_hours, employee.standard_daily_hours))
    overtime_hours = _hours(max(net_hours - employee.standard_daily_hours, Decimal("0")))
    hourly_rate = _money(employee.daily_rate / employee.standard_daily_hours)
    overtime_amount = _money(overtime_hours * hourly_rate)

    if payment_mode == WorkPaymentMode.FULL_DAY:
        base_amount = _money(employee.daily_rate if net_hours > 0 else Decimal("0"))
    else:
        base_amount = _money(regular_hours * hourly_rate)

    total_amount = _money(base_amount + overtime_amount)

    return {
        "clock_in": clock_in,
        "clock_out": clock_out,
        "break_hours": _hours(break_hours),
        "gross_hours": gross_hours,
        "net_hours": net_hours,
        "regular_hours": regular_hours,
        "overtime_hours": overtime_hours,
        "payment_mode": payment_mode,
        "work_type": _legacy_work_type(payment_mode, net_hours, regular_hours, employee.standard_daily_hours),
        "base_amount": base_amount,
        "overtime_amount": overtime_amount,
        "total_amount": total_amount,
        "amount": total_amount,
    }


def _time_delta_hours(clock_in: time, clock_out: time) -> Decimal:
    in_minutes = clock_in.hour * 60 + clock_in.minute
    out_minutes = clock_out.hour * 60 + clock_out.minute
    if out_minutes <= in_minutes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hora de saida deve ser maior que a hora de entrada.",
        )
    return _hours(Decimal(out_minutes - in_minutes) / Decimal("60"))


def _legacy_work_type(
    payment_mode: WorkPaymentMode,
    net_hours: Decimal,
    regular_hours: Decimal,
    standard_daily_hours: Decimal,
) -> WorkType:
    if net_hours <= 0:
        return WorkType.ABSENCE
    if payment_mode == WorkPaymentMode.FULL_DAY or regular_hours >= standard_daily_hours:
        return WorkType.FULL_DAY
    return WorkType.HALF_DAY


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def _hours(value: Decimal) -> Decimal:
    return value.quantize(HOUR_QUANTIZER, rounding=ROUND_HALF_UP)


def _apply_date_filters(query, start_date: date | None, end_date: date | None):
    if start_date is not None:
        query = query.where(EmployeeWorkLog.work_date >= start_date)
    if end_date is not None:
        query = query.where(EmployeeWorkLog.work_date <= end_date)
    return query


def ensure_work_log_can_change(work_log: EmployeeWorkLog, db: Session) -> None:
    if work_log.payment_status == EmployeePaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este registro de trabalho ja foi pago.",
        )
    if work_log.weekly_closing_id is None:
        return
    closing_status = db.scalar(
        select(WeeklyClosing.status).where(WeeklyClosing.id == work_log.weekly_closing_id)
    )
    if closing_status in {WeeklyClosingStatus.CLOSED, WeeklyClosingStatus.PAID}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este registro ja pertence a um fechamento fechado.",
        )
