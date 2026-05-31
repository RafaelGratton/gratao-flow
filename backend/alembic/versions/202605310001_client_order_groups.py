"""client order groups

Revision ID: 202605310001
Revises: 202605280002
Create Date: 2026-05-31 00:01:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605310001"
down_revision: str | None = "202605280002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "client_order_groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("reference", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_client_order_groups_id"),
        "client_order_groups",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_client_order_groups_client_id"),
        "client_order_groups",
        ["client_id"],
        unique=False,
    )
    op.add_column("orders", sa.Column("client_order_group_id", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_orders_client_order_group_id"),
        "orders",
        ["client_order_group_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_orders_client_order_group_id_client_order_groups"),
        "orders",
        "client_order_groups",
        ["client_order_group_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_orders_client_order_group_id_client_order_groups"),
        "orders",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_orders_client_order_group_id"), table_name="orders")
    op.drop_column("orders", "client_order_group_id")
    op.drop_index(op.f("ix_client_order_groups_client_id"), table_name="client_order_groups")
    op.drop_index(op.f("ix_client_order_groups_id"), table_name="client_order_groups")
    op.drop_table("client_order_groups")
