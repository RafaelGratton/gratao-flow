from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.enums import PayoutStatus, WeeklyClosingStatus
from app.models.order import Order, OrderPayment
from app.models.outsourcing import OrderOutsourcing
from app.models.user import User
from app.models.weekly_closing import WeeklyClosing
from app.schemas.weekly_closing import WeeklyClosingCreate, WeeklyClosingRead

router = APIRouter(dependencies=[Depends(get_current_admin)])

MONEY_QUANTIZER = Decimal("0.01")


@router.post("", response_model=WeeklyClosingRead, status_code=201)
def create_weekly_closing(
    payload: WeeklyClosingCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
) -> WeeklyClosing:
    _ensure_period_does_not_overlap(db, payload.start_date, payload.end_date)

    totals = _calculate_totals(db, payload.start_date, payload.end_date)
    closing = WeeklyClosing(
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
        status=WeeklyClosingStatus.OPEN,
        **totals,
    )

    db.add(closing)
    db.flush()

    orders = _orders_in_period(db, payload.start_date, payload.end_date)
    for order in orders:
        order.weekly_closing_id = closing.id

    db.commit()
    db.refresh(closing)
    return closing


@router.get("", response_model=list[WeeklyClosingRead])
def list_weekly_closings(
    db: Annotated[Session, Depends(get_db)],
) -> list[WeeklyClosing]:
    query = select(WeeklyClosing).order_by(WeeklyClosing.start_date.desc(), WeeklyClosing.id.desc())
    return list(db.scalars(query))


@router.get("/{closing_id}", response_model=WeeklyClosingRead)
def get_weekly_closing(
    closing_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> WeeklyClosing:
    return _get_weekly_closing_or_404(db, closing_id)


@router.post("/{closing_id}/close", response_model=WeeklyClosingRead)
def close_weekly_closing(
    closing_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> WeeklyClosing:
    closing = _get_weekly_closing_or_404(db, closing_id)
    if closing.status == WeeklyClosingStatus.CLOSED:
        return closing

    closing.status = WeeklyClosingStatus.CLOSED
    closing.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(closing)
    return closing


def _ensure_period_does_not_overlap(db: Session, start_date: date, end_date: date) -> None:
    query = select(WeeklyClosing.id).where(
        WeeklyClosing.start_date <= end_date,
        WeeklyClosing.end_date >= start_date,
    )
    if db.scalar(query) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Periodo sobrepoe outro fechamento semanal existente.",
        )


def _calculate_totals(db: Session, start_date: date, end_date: date) -> dict[str, Any]:
    order_totals = _one(
        db.execute(
            select(
                func.count(Order.id),
                func.coalesce(func.sum(Order.quantity_requested), 0),
                func.coalesce(func.sum(Order.quantity_cut), 0),
                func.coalesce(func.sum(Order.quantity_printed), 0),
                func.coalesce(func.sum(Order.quantity_sewn), 0),
                func.coalesce(func.sum(Order.total_amount), 0),
                func.coalesce(func.sum(Order.amount_due), 0),
            ).where(_date_between(Order.created_at, start_date, end_date))
        )
    )
    total_received = _money(
        db.scalar(
            select(func.coalesce(func.sum(OrderPayment.amount), 0)).where(
                _date_between(OrderPayment.paid_at, start_date, end_date)
            )
        )
    )
    outsourcing_totals = _one(
        db.execute(
            select(
                func.coalesce(func.sum(OrderOutsourcing.customer_total), 0),
                func.coalesce(func.sum(OrderOutsourcing.outsourcer_total), 0),
                func.coalesce(func.sum(OrderOutsourcing.profit_total), 0),
            ).where(_date_between(OrderOutsourcing.sent_at, start_date, end_date))
        )
    )
    total_payout_paid = _money(
        db.scalar(
            select(func.coalesce(func.sum(OrderOutsourcing.outsourcer_total), 0)).where(
                OrderOutsourcing.payout_status == PayoutStatus.PAID,
                OrderOutsourcing.paid_at.is_not(None),
                _date_between(OrderOutsourcing.paid_at, start_date, end_date),
            )
        )
    )
    total_payout_pending = _money(
        db.scalar(
            select(func.coalesce(func.sum(OrderOutsourcing.outsourcer_total), 0)).where(
                OrderOutsourcing.payout_status == PayoutStatus.PENDING,
                _date_between(OrderOutsourcing.sent_at, start_date, end_date),
            )
        )
    )

    total_outsourcing_profit = _money(outsourcing_totals[2])
    gross_result = _money(total_received + total_outsourcing_profit - total_payout_paid)

    return {
        "total_orders": order_totals[0],
        "total_pieces_requested": order_totals[1],
        "total_pieces_cut": order_totals[2],
        "total_pieces_printed": order_totals[3],
        "total_pieces_sewn": order_totals[4],
        "total_invoiced": _money(order_totals[5]),
        "total_received": total_received,
        "total_pending": _money(order_totals[6]),
        "total_outsourcing_customer": _money(outsourcing_totals[0]),
        "total_outsourcing_payout": _money(outsourcing_totals[1]),
        "total_outsourcing_profit": total_outsourcing_profit,
        "total_payout_paid": total_payout_paid,
        "total_payout_pending": total_payout_pending,
        "gross_result": gross_result,
    }


def _orders_in_period(db: Session, start_date: date, end_date: date) -> list[Order]:
    query = select(Order).where(_date_between(Order.created_at, start_date, end_date))
    return list(db.scalars(query))


def _get_weekly_closing_or_404(db: Session, closing_id: int) -> WeeklyClosing:
    closing = db.get(WeeklyClosing, closing_id)
    if closing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly closing not found",
        )
    return closing


def _date_between(column: Any, start_date: date, end_date: date) -> Any:
    return cast(column, Date).between(start_date, end_date)


def _one(result: Any) -> Any:
    return result.one()


def _money(value: Decimal | int | None) -> Decimal:
    return Decimal(value or 0).quantize(MONEY_QUANTIZER)
