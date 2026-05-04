"""weekly closings

Revision ID: 202605010006
Revises: 202605010005
Create Date: 2026-05-03 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605010006"
down_revision: str | None = "202605010005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

weekly_closing_status_enum = postgresql.ENUM(
    "open",
    "closed",
    name="weekly_closing_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    weekly_closing_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "weekly_closings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("total_orders", sa.Integer(), nullable=False),
        sa.Column("total_pieces_requested", sa.Integer(), nullable=False),
        sa.Column("total_pieces_cut", sa.Integer(), nullable=False),
        sa.Column("total_pieces_printed", sa.Integer(), nullable=False),
        sa.Column("total_pieces_sewn", sa.Integer(), nullable=False),
        sa.Column("total_invoiced", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_received", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_pending", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_outsourcing_customer", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_outsourcing_payout", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_outsourcing_profit", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_payout_paid", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_payout_pending", sa.Numeric(10, 2), nullable=False),
        sa.Column("gross_result", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "status",
            weekly_closing_status_enum,
            server_default="open",
            nullable=False,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_weekly_closings_id"), "weekly_closings", ["id"], unique=False)

    op.add_column(
        "orders",
        sa.Column("weekly_closing_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_orders_weekly_closing_id_weekly_closings",
        "orders",
        "weekly_closings",
        ["weekly_closing_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_orders_weekly_closing_id"),
        "orders",
        ["weekly_closing_id"],
        unique=False,
    )

    op.alter_column("weekly_closings", "status", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index(op.f("ix_orders_weekly_closing_id"), table_name="orders")
    op.drop_constraint(
        "fk_orders_weekly_closing_id_weekly_closings",
        "orders",
        type_="foreignkey",
    )
    op.drop_column("orders", "weekly_closing_id")

    op.drop_index(op.f("ix_weekly_closings_id"), table_name="weekly_closings")
    op.drop_table("weekly_closings")

    weekly_closing_status_enum.drop(bind, checkfirst=True)
