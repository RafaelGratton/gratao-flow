from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.employees import (
    calculate_employee_work_log,
    ensure_work_log_can_change,
    open_employee_work_log_values,
)
from app.db.session import get_db
from app.models.employee import Employee, EmployeeWorkLog
from app.models.enums import EmployeePaymentStatus
from app.schemas.employee import WorkLogClockOut, WorkLogRead, WorkLogUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])


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
) -> EmployeeWorkLog:
    work_log = _get_work_log_or_404(db, work_log_id)
    ensure_work_log_can_change(work_log, db)
    employee = db.get(Employee, work_log.employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee not found",
        )

    new_work_date = payload.work_date or work_log.work_date
    if new_work_date != work_log.work_date:
        existing_id = db.scalar(
            select(EmployeeWorkLog.id).where(
                EmployeeWorkLog.employee_id == work_log.employee_id,
                EmployeeWorkLog.work_date == new_work_date,
            )
        )
        if existing_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee already has a work log for this date",
            )
        work_log.work_date = new_work_date

    clock_in = payload.clock_in or work_log.clock_in
    clock_out = payload.clock_out or work_log.clock_out
    if clock_in is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hora de entrada e obrigatoria.",
        )

    break_hours = payload.break_hours if payload.break_hours is not None else work_log.break_hours
    payment_mode = payload.payment_mode or work_log.payment_mode
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
    for field, value in calculated.items():
        setattr(work_log, field, value)
    if payload.notes is not None:
        work_log.notes = payload.notes

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
