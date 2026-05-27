"""cut piece stock allocation and production pause

Revision ID: 202605260001
Revises: 202605210001
Create Date: 2026-05-26 00:00:00.000000

New cuts are booked as available piece stock. Existing quantity_cut values are
left untouched and remain allocated to their orders.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605260001"
down_revision: str | None = "202605210001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'cut_entry'")
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'allocated_to_order'")
    op.execute("ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'returned_from_order'")

    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'cut_pieces_allocated'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'cut_pieces_returned'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'production_paused'")
    op.execute("ALTER TYPE production_event_type ADD VALUE IF NOT EXISTS 'production_resumed'")

    op.add_column(
        "orders",
        sa.Column("production_paused", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.alter_column("orders", "production_paused", server_default=None)


def downgrade() -> None:
    op.drop_column("orders", "production_paused")
