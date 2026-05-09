"""item deliveries

Revision ID: 202605010013
Revises: 202605010012
Create Date: 2026-05-09 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010013"
down_revision: str | None = "202605010012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


delivery_status_enum = sa.Enum(
    "pending",
    "ready",
    "partially_delivered",
    "delivered",
    name="delivery_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    delivery_status_enum.create(bind, checkfirst=True)

    op.add_column(
        "order_items",
        sa.Column("quantity_delivered", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "order_items",
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "order_items",
        sa.Column(
            "delivery_status",
            delivery_status_enum,
            nullable=False,
            server_default="pending",
        ),
    )

    op.create_table(
        "delivery_history",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("order_item_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("responsible", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "delivered_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["order_item_id"], ["order_items.id"]),
    )
    op.create_index(
        "ix_delivery_history_order_item_id",
        "delivery_history",
        ["order_item_id"],
        unique=False,
    )
    op.create_index(
        "ix_delivery_history_order_id",
        "delivery_history",
        ["order_id"],
        unique=False,
    )

    op.execute(
        sa.text(
            """
            UPDATE order_items
            SET delivery_status = 'ready'::delivery_status
            WHERE
                quantity_delivered = 0
                AND (
                    (
                        sewing_mode = 'outsourced'::sewing_mode
                        AND EXISTS (
                            SELECT 1
                            FROM order_outsourcings
                            WHERE
                                order_outsourcings.order_id = order_items.order_id
                                AND order_outsourcings.status = 'returned'::outsourcing_status
                        )
                        AND NOT EXISTS (
                            SELECT 1
                            FROM order_outsourcings
                            WHERE
                                order_outsourcings.order_id = order_items.order_id
                                AND order_outsourcings.status NOT IN (
                                    'returned'::outsourcing_status,
                                    'cancelled'::outsourcing_status
                                )
                        )
                    )
                    OR (
                        sewing_mode IS DISTINCT FROM 'outsourced'::sewing_mode
                        AND (
                            (
                                EXISTS (
                                    SELECT 1
                                    FROM order_item_services
                                    JOIN services ON services.id = order_item_services.service_id
                                    WHERE
                                        order_item_services.order_item_id = order_items.id
                                        AND services.type = 'confeccao'
                                )
                                AND quantity_sewn >= quantity_requested
                            )
                            OR (
                                NOT EXISTS (
                                    SELECT 1
                                    FROM order_item_services
                                    JOIN services ON services.id = order_item_services.service_id
                                    WHERE
                                        order_item_services.order_item_id = order_items.id
                                        AND services.type = 'confeccao'
                                )
                                AND EXISTS (
                                    SELECT 1
                                    FROM order_item_services
                                    JOIN services ON services.id = order_item_services.service_id
                                    WHERE
                                        order_item_services.order_item_id = order_items.id
                                        AND services.type = 'serigrafia'
                                )
                                AND quantity_printed >= quantity_requested
                            )
                            OR (
                                NOT EXISTS (
                                    SELECT 1
                                    FROM order_item_services
                                    JOIN services ON services.id = order_item_services.service_id
                                    WHERE
                                        order_item_services.order_item_id = order_items.id
                                        AND services.type IN ('confeccao', 'serigrafia')
                                )
                                AND EXISTS (
                                    SELECT 1
                                    FROM order_item_services
                                    JOIN services ON services.id = order_item_services.service_id
                                    WHERE
                                        order_item_services.order_item_id = order_items.id
                                        AND services.type = 'corte'
                                )
                                AND quantity_cut >= quantity_requested
                            )
                        )
                    )
                )
            """
        )
    )

    op.alter_column("order_items", "quantity_delivered", server_default=None)
    op.alter_column("order_items", "delivery_status", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_delivery_history_order_id", table_name="delivery_history")
    op.drop_index("ix_delivery_history_order_item_id", table_name="delivery_history")
    op.drop_table("delivery_history")
    op.drop_column("order_items", "delivery_status")
    op.drop_column("order_items", "delivered_at")
    op.drop_column("order_items", "quantity_delivered")
    delivery_status_enum.drop(op.get_bind(), checkfirst=True)
