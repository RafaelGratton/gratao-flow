"""order item cancellation

Revision ID: 202605280002
Revises: 202605280001
Create Date: 2026-05-28 00:02:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605280002"
down_revision: str | None = "202605280001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'order_item_cancelled'")
    op.add_column(
        "order_items",
        sa.Column("is_cancelled", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.add_column(
        "order_items",
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("order_items", sa.Column("cancel_reason", sa.Text(), nullable=True))
    op.alter_column("order_items", "is_cancelled", server_default=None)


def downgrade() -> None:
    op.drop_column("order_items", "cancel_reason")
    op.drop_column("order_items", "cancelled_at")
    op.drop_column("order_items", "is_cancelled")
