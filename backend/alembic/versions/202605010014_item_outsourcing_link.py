"""link outsourcing to order items

Revision ID: 202605010014
Revises: 202605010013
Create Date: 2026-05-09 00:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010014"
down_revision: str | None = "202605010013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "order_outsourcings",
        sa.Column("order_item_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_order_outsourcings_order_item_id_order_items",
        "order_outsourcings",
        "order_items",
        ["order_item_id"],
        ["id"],
    )
    op.create_index(
        "ix_order_outsourcings_order_item_id",
        "order_outsourcings",
        ["order_item_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_order_outsourcings_order_item_id", table_name="order_outsourcings")
    op.drop_constraint(
        "fk_order_outsourcings_order_item_id_order_items",
        "order_outsourcings",
        type_="foreignkey",
    )
    op.drop_column("order_outsourcings", "order_item_id")
