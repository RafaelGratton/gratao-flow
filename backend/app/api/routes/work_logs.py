from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.employee import Employee, EmployeeWorkLog
from app.models.enums import EmployeePaymentStatus, WorkType
from app.schemas.employee import WorkLogRead, WorkLogUpdate

router = APIRouter(dependencies=[Depends(get_current_admin)])
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
    _ensure_work_log_is_pending(work_log)

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
) -> EmployeeWorkLog:
    work_log = _get_work_log_or_404(db, work_log_id)
    _ensure_work_log_is_pending(work_log)

    if payload.work_type is not None:
        employee = db.get(Employee, work_log.employee_id)
        if employee is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee not found",
            )
        work_log.work_type = payload.work_type
        work_log.amount = _calculate_amount(employee.daily_rate, payload.work_type)
    if payload.notes is not None:
        work_log.notes = payload.notes

    db.commit()
    db.refresh(work_log)
    return work_log


@router.delete("/{work_log_id}", status_code=204)
def delete_work_log(
    work_log_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> None:
    work_log = _get_work_log_or_404(db, work_log_id)
    _ensure_work_log_is_pending(work_log)
    db.delete(work_log)
    db.commit()


def _get_work_log_or_404(db: Session, work_log_id: int) -> EmployeeWorkLog:
    work_log = db.get(EmployeeWorkLog, work_log_id)
    if work_log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work log not found",
        )
    return work_log


def _ensure_work_log_is_pending(work_log: EmployeeWorkLog) -> None:
    if work_log.payment_status == EmployeePaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este registro de trabalho já foi pago.",
        )


def _calculate_amount(daily_rate: Decimal, work_type: WorkType) -> Decimal:
    if work_type == WorkType.FULL_DAY:
        return _money(daily_rate)
    if work_type == WorkType.HALF_DAY:
        return _money(daily_rate / Decimal("2"))
    return Decimal("0.00")


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTIZER)
