from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.employee import Employee, EmployeeWorkLog
from app.models.enums import EmployeePaymentStatus, WorkType
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeRead, WorkLogCreate, WorkLogRead

router = APIRouter(dependencies=[Depends(get_current_user)])

MONEY_QUANTIZER = Decimal("0.01")


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


@router.post("/{employee_id}/work-logs", response_model=WorkLogRead, status_code=201)
def create_employee_work_log(
    employee_id: int,
    payload: WorkLogCreate,
    db: Annotated[Session, Depends(get_db)],
) -> EmployeeWorkLog:
    employee = _get_employee_or_404(db, employee_id)
    _ensure_work_log_does_not_exist(db, employee.id, payload.work_date)

    work_log = EmployeeWorkLog(
        employee_id=employee.id,
        work_date=payload.work_date,
        work_type=payload.work_type,
        amount=_calculate_amount(employee.daily_rate, payload.work_type),
        payment_status=EmployeePaymentStatus.PENDING,
        notes=payload.notes,
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


def _calculate_amount(daily_rate: Decimal, work_type: WorkType) -> Decimal:
    if work_type == WorkType.FULL_DAY:
        return _money(daily_rate)
    if work_type == WorkType.HALF_DAY:
        return _money(daily_rate / Decimal("2"))
    return Decimal("0.00")


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTIZER)


def _apply_date_filters(query, start_date: date | None, end_date: date | None):
    if start_date is not None:
        query = query.where(EmployeeWorkLog.work_date >= start_date)
    if end_date is not None:
        query = query.where(EmployeeWorkLog.work_date <= end_date)
    return query
