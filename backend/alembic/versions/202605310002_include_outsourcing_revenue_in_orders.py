"""include outsourcing revenue in order totals

Revision ID: 202605310002
Revises: 202605310001
Create Date: 2026-05-31 00:02:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "202605310002"
down_revision: str | None = "202605310001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH outsourcing_revenue AS (
            SELECT
                order_id,
                COALESCE(SUM(customer_total), 0)::numeric(10, 2) AS revenue
            FROM order_outsourcings
            WHERE status != 'cancelled'
            GROUP BY order_id
        )
        UPDATE orders
        SET
            total_amount = (orders.total_amount + outsourcing_revenue.revenue)::numeric(10, 2),
            amount_due = GREATEST(
                (orders.total_amount + outsourcing_revenue.revenue - orders.amount_paid)::numeric(10, 2),
                0
            ),
            financial_status = CASE
                WHEN orders.amount_paid = 0 THEN 'pending'::financial_status
                WHEN orders.amount_paid < (orders.total_amount + outsourcing_revenue.revenue)
                    THEN 'partial'::financial_status
                ELSE 'paid'::financial_status
            END
        FROM outsourcing_revenue
        WHERE orders.id = outsourcing_revenue.order_id
        """
    )


def downgrade() -> None:
    op.execute(
        """
        WITH outsourcing_revenue AS (
            SELECT
                order_id,
                COALESCE(SUM(customer_total), 0)::numeric(10, 2) AS revenue
            FROM order_outsourcings
            WHERE status != 'cancelled'
            GROUP BY order_id
        )
        UPDATE orders
        SET
            total_amount = GREATEST(
                (orders.total_amount - outsourcing_revenue.revenue)::numeric(10, 2),
                0
            ),
            amount_due = GREATEST(
                (orders.total_amount - outsourcing_revenue.revenue - orders.amount_paid)::numeric(10, 2),
                0
            ),
            financial_status = CASE
                WHEN orders.amount_paid = 0 THEN 'pending'::financial_status
                WHEN orders.amount_paid < GREATEST(
                    (orders.total_amount - outsourcing_revenue.revenue)::numeric(10, 2),
                    0
                )
                    THEN 'partial'::financial_status
                ELSE 'paid'::financial_status
            END
        FROM outsourcing_revenue
        WHERE orders.id = outsourcing_revenue.order_id
        """
    )
