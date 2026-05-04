"""outsourcing module

Revision ID: 202605010004
Revises: 202605010003
Create Date: 2026-05-02 00:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605010004"
down_revision: str | None = "202605010003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

outsourcing_status_enum = postgresql.ENUM(
    "sent",
    "partially_returned",
    "returned",
    "delivered_direct",
    "cancelled",
    name="outsourcing_status",
    create_type=False,
)
payout_status_enum = postgresql.ENUM(
    "pending",
    "paid",
    name="payout_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    outsourcing_status_enum.create(bind, checkfirst=True)
    payout_status_enum.create(bind, checkfirst=True)

    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'outsourcing_sent'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'outsourcing_returned'")
    op.execute(
        "ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'outsourcing_payout_paid'"
    )

    op.create_table(
        "outsourcers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_outsourcers_id"), "outsourcers", ["id"], unique=False)

    op.create_table(
        "order_outsourcings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("outsourcer_id", sa.Integer(), nullable=True),
        sa.Column("quantity_sent", sa.Integer(), nullable=False),
        sa.Column("quantity_returned", sa.Integer(), server_default="0", nullable=False),
        sa.Column("customer_unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("outsourcer_unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("customer_total", sa.Numeric(10, 2), nullable=False),
        sa.Column("outsourcer_total", sa.Numeric(10, 2), nullable=False),
        sa.Column("profit_total", sa.Numeric(10, 2), nullable=False),
        sa.Column("return_expected", sa.Boolean(), nullable=False),
        sa.Column("direct_to_customer", sa.Boolean(), nullable=False),
        sa.Column("status", outsourcing_status_enum, nullable=False),
        sa.Column(
            "payout_status",
            payout_status_enum,
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["outsourcer_id"], ["outsourcers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_order_outsourcings_id"), "order_outsourcings", ["id"], unique=False
    )

    op.alter_column("outsourcers", "is_active", server_default=None)
    op.alter_column("order_outsourcings", "quantity_returned", server_default=None)
    op.alter_column("order_outsourcings", "payout_status", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index(op.f("ix_order_outsourcings_id"), table_name="order_outsourcings")
    op.drop_table("order_outsourcings")
    op.drop_index(op.f("ix_outsourcers_id"), table_name="outsourcers")
    op.drop_table("outsourcers")

    payout_status_enum.drop(bind, checkfirst=True)
    outsourcing_status_enum.drop(bind, checkfirst=True)
