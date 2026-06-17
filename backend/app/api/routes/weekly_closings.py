from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.employee import Employee, EmployeeWorkLog
from app.models.enums import EmployeePaymentStatus, WeeklyClosingStatus
from app.models.user import User
from app.models.weekly_closing import WeeklyClosing
from app.schemas.weekly_closing import WeeklyClosingCreate, WeeklyClosingRead
from app.services.reports import generate_weekly_closing_report_pdf

router = APIRouter(dependencies=[Depends(get_current_user)])

MONEY_QUANTIZER = Decimal("0.01")


@router.post("", response_model=WeeklyClosingRead, status_code=201)
def create_weekly_closing(
    payload: WeeklyClosingCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> WeeklyClosing:
    employee = db.get(Employee, payload.employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    _ensure_period_does_not_overlap(db, payload.employee_id, payload.start_date, payload.end_date)
    _ensure_no_open_work_logs_in_period(db, payload.employee_id, payload.start_date, payload.end_date)

    work_logs = _work_logs_in_period(db, payload.employee_id, payload.start_date, payload.end_date)
    if not work_logs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao existem registros concluidos e em aberto para pagamento neste periodo.",
        )
    totals = _calculate_employee_totals(work_logs, payload.discounts, payload.advances)
    closing = WeeklyClosing(
        employee_id=payload.employee_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
        status=WeeklyClosingStatus.OPEN,
        employee_pix_key_type=employee.pix_key_type,
        employee_pix_key=employee.pix_key,
        **totals,
        **_legacy_zero_totals(),
    )

    db.add(closing)
    db.flush()

    for work_log in work_logs:
        if work_log.weekly_closing_id is not None or work_log.payment_status == EmployeePaymentStatus.PAID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Um ou mais registros ja pertencem a outro fechamento.",
            )
        work_log.weekly_closing_id = closing.id

    db.commit()
    db.refresh(closing)
    return closing


@router.get("", response_model=list[WeeklyClosingRead])
def list_weekly_closings(
    db: Annotated[Session, Depends(get_db)],
    employee_id: int | None = None,
) -> list[WeeklyClosing]:
    query = select(WeeklyClosing)
    if employee_id is not None:
        query = query.where(WeeklyClosing.employee_id == employee_id)
    query = query.order_by(WeeklyClosing.start_date.desc(), WeeklyClosing.id.desc())
    return list(db.scalars(query))


@router.get("/{closing_id}", response_model=WeeklyClosingRead)
def get_weekly_closing(
    closing_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> WeeklyClosing:
    return _get_weekly_closing_or_404(db, closing_id)


@router.get("/{closing_id}/report/pdf")
def get_weekly_closing_report_pdf(
    closing_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    closing = _get_weekly_closing_or_404(db, closing_id)
    pdf = generate_weekly_closing_report_pdf(closing)
    employee_name = closing.employee.name if closing.employee else f"funcionario-{closing.employee_id or closing.id}"
    filename = _safe_pdf_filename(f"fechamento-{employee_name}-{closing.start_date}-a-{closing.end_date}")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/{closing_id}/close", response_model=WeeklyClosingRead)
def close_weekly_closing(
    closing_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> WeeklyClosing:
    closing = _get_weekly_closing_or_404(db, closing_id)
    if closing.status in {WeeklyClosingStatus.CLOSED, WeeklyClosingStatus.PAID}:
        return closing

    closing.status = WeeklyClosingStatus.CLOSED
    closing.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(closing)
    return closing


@router.post("/{closing_id}/pay", response_model=WeeklyClosingRead)
def pay_weekly_closing(
    closing_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> WeeklyClosing:
    closing = _get_weekly_closing_or_404(db, closing_id)
    if closing.status == WeeklyClosingStatus.PAID:
        return closing

    now = datetime.now(timezone.utc)
    closing.status = WeeklyClosingStatus.PAID
    if closing.closed_at is None:
        closing.closed_at = now
    closing.paid_at = now
    for work_log in closing.work_logs:
        work_log.payment_status = EmployeePaymentStatus.PAID
        work_log.paid_at = now

    db.commit()
    db.refresh(closing)
    return closing


def _ensure_period_does_not_overlap(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: date,
) -> None:
    query = select(WeeklyClosing.id).where(
        WeeklyClosing.employee_id == employee_id,
        WeeklyClosing.start_date <= end_date,
        WeeklyClosing.end_date >= start_date,
    )
    if db.scalar(query) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Periodo sobrepoe outro fechamento semanal deste funcionario.",
        )


def _work_logs_in_period(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: date,
) -> list[EmployeeWorkLog]:
    query = (
        select(EmployeeWorkLog)
        .where(
            EmployeeWorkLog.employee_id == employee_id,
            EmployeeWorkLog.work_date >= start_date,
            EmployeeWorkLog.work_date <= end_date,
            EmployeeWorkLog.clock_out.is_not(None),
            EmployeeWorkLog.weekly_closing_id.is_(None),
            EmployeeWorkLog.payment_status == EmployeePaymentStatus.PENDING,
        )
        .order_by(EmployeeWorkLog.work_date)
    )
    return list(db.scalars(query))


def _ensure_no_open_work_logs_in_period(
    db: Session,
    employee_id: int,
    start_date: date,
    end_date: date,
) -> None:
    open_log_id = db.scalar(
        select(EmployeeWorkLog.id).where(
            EmployeeWorkLog.employee_id == employee_id,
            EmployeeWorkLog.work_date >= start_date,
            EmployeeWorkLog.work_date <= end_date,
            EmployeeWorkLog.clock_out.is_(None),
        )
    )
    if open_log_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Existem registros sem hora de saida neste periodo. Finalize o ponto antes do fechamento.",
        )


def _calculate_employee_totals(
    work_logs: list[EmployeeWorkLog],
    discounts: Decimal,
    advances: Decimal,
) -> dict[str, Any]:
    total_base = _sum_money(log.base_amount for log in work_logs)
    total_overtime = _sum_money(log.overtime_amount for log in work_logs)
    total_payable = _money(total_base + total_overtime - discounts - advances)

    return {
        "days_worked": sum(1 for log in work_logs if log.net_hours > 0),
        "total_gross_hours": _sum_hours(log.gross_hours for log in work_logs),
        "total_break_hours": _sum_hours(log.break_hours for log in work_logs),
        "total_net_hours": _sum_hours(log.net_hours for log in work_logs),
        "total_regular_hours": _sum_hours(log.regular_hours for log in work_logs),
        "total_overtime_hours": _sum_hours(log.overtime_hours for log in work_logs),
        "total_base_amount": total_base,
        "total_overtime_amount": total_overtime,
        "discounts": _money(discounts),
        "advances": _money(advances),
        "total_payable": total_payable,
    }


def _legacy_zero_totals() -> dict[str, Decimal | int]:
    return {
        "total_orders": 0,
        "total_pieces_requested": 0,
        "total_pieces_cut": 0,
        "total_pieces_printed": 0,
        "total_pieces_sewn": 0,
        "total_invoiced": Decimal("0.00"),
        "total_received": Decimal("0.00"),
        "total_pending": Decimal("0.00"),
        "total_outsourcing_customer": Decimal("0.00"),
        "total_outsourcing_payout": Decimal("0.00"),
        "total_outsourcing_profit": Decimal("0.00"),
        "total_payout_paid": Decimal("0.00"),
        "total_payout_pending": Decimal("0.00"),
        "gross_result": Decimal("0.00"),
    }


def _get_weekly_closing_or_404(db: Session, closing_id: int) -> WeeklyClosing:
    closing = db.get(WeeklyClosing, closing_id)
    if closing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly closing not found",
        )
    return closing


def _safe_pdf_filename(value: str) -> str:
    safe = "".join(character.lower() if character.isalnum() else "-" for character in value)
    safe = "-".join(part for part in safe.split("-") if part)
    return f"{safe}.pdf"


def _sum_money(values) -> Decimal:
    return _money(sum((Decimal(value or 0) for value in values), Decimal("0")))


def _sum_hours(values) -> Decimal:
    return _money(sum((Decimal(value or 0) for value in values), Decimal("0")))


def _money(value: Decimal | int | None) -> Decimal:
    return Decimal(value or 0).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)
