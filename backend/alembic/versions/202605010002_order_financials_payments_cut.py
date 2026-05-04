"""order financials payments and cut

Revision ID: 202605010002
Revises: 202605010001
Create Date: 2026-05-01 22:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605010002"
down_revision: str | None = "202605010001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

payment_method_enum = postgresql.ENUM(
    "pix",
    "cash",
    "card",
    "boleto",
    name="payment_method",
    create_type=False,
)
production_event_type_enum = postgresql.ENUM(
    "cut_registered",
    "status_changed",
    name="production_event_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    payment_method_enum.create(bind, checkfirst=True)
    production_event_type_enum.create(bind, checkfirst=True)

    op.execute("UPDATE orders SET quantity_cut = 0 WHERE quantity_cut IS NULL")
    op.alter_column("orders", "quantity_cut", existing_type=sa.Integer(), nullable=False)
    op.add_column(
        "orders",
        sa.Column(
            "total_amount",
            sa.Numeric(10, 2),
            server_default="0.00",
            nullable=False,
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "amount_paid",
            sa.Numeric(10, 2),
            server_default="0.00",
            nullable=False,
        ),
    )
    op.add_column(
        "orders",
        sa.Column(
            "amount_due",
            sa.Numeric(10, 2),
            server_default="0.00",
            nullable=False,
        ),
    )

    op.create_table(
        "order_services",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_order_services_id"), "order_services", ["id"], unique=False)

    op.create_table(
        "order_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", payment_method_enum, nullable=False),
        sa.Column(
            "paid_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_order_payments_id"), "order_payments", ["id"], unique=False)

    op.create_table(
        "production_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("event_type", production_event_type_enum, nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_production_events_id"), "production_events", ["id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index(op.f("ix_production_events_id"), table_name="production_events")
    op.drop_table("production_events")
    op.drop_index(op.f("ix_order_payments_id"), table_name="order_payments")
    op.drop_table("order_payments")
    op.drop_index(op.f("ix_order_services_id"), table_name="order_services")
    op.drop_table("order_services")

    op.drop_column("orders", "amount_due")
    op.drop_column("orders", "amount_paid")
    op.drop_column("orders", "total_amount")
    op.alter_column("orders", "quantity_cut", existing_type=sa.Integer(), nullable=True)

    production_event_type_enum.drop(bind, checkfirst=True)
    payment_method_enum.drop(bind, checkfirst=True)
