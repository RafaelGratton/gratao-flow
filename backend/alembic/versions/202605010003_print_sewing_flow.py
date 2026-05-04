"""print sewing flow

Revision ID: 202605010003
Revises: 202605010002
Create Date: 2026-05-01 23:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605010003"
down_revision: str | None = "202605010002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

print_type_enum = postgresql.ENUM(
    "front",
    "front_back",
    name="print_type",
    create_type=False,
)
production_status_enum = postgresql.ENUM(
    "created",
    "in_cut",
    "cut_done",
    "waiting_print",
    "in_print",
    "print_done",
    "waiting_sewing",
    "in_sewing",
    "sewing_done",
    "outsourced",
    "returned",
    "ready",
    "delivered",
    "cancelled",
    name="production_status",
    create_type=False,
)


def upgrade() -> None:
    print_type_enum.create(op.get_bind(), checkfirst=True)

    op.execute("ALTER TYPE production_status ADD VALUE IF NOT EXISTS 'waiting_print'")
    op.execute("ALTER TYPE production_status ADD VALUE IF NOT EXISTS 'waiting_sewing'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'print_registered'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'sewing_registered'")

    op.add_column("orders", sa.Column("print_type", print_type_enum, nullable=True))
    op.add_column(
        "orders",
        sa.Column(
            "allow_printing_exception",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "orders",
        sa.Column("quantity_printed", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "orders",
        sa.Column("quantity_sewn", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "production_events",
        sa.Column("from_status", production_status_enum, nullable=True),
    )
    op.add_column(
        "production_events",
        sa.Column("to_status", production_status_enum, nullable=True),
    )

    op.alter_column("orders", "allow_printing_exception", server_default=None)
    op.alter_column("orders", "quantity_printed", server_default=None)
    op.alter_column("orders", "quantity_sewn", server_default=None)


def downgrade() -> None:
    op.drop_column("production_events", "to_status")
    op.drop_column("production_events", "from_status")
    op.drop_column("orders", "quantity_sewn")
    op.drop_column("orders", "quantity_printed")
    op.drop_column("orders", "allow_printing_exception")
    op.drop_column("orders", "print_type")
    print_type_enum.drop(op.get_bind(), checkfirst=True)
