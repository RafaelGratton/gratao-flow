"""order items

Revision ID: 202605010010
Revises: 202605010009
Create Date: 2026-05-08 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605010010"
down_revision: str | None = "202605010009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("size_id", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(length=100), nullable=False),
        sa.Column("quantity_requested", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["size_id"], ["sizes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_order_items_id"), "order_items", ["id"], unique=False)
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"], unique=False)

    op.create_table(
        "order_item_services",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_item_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["order_item_id"], ["order_items.id"]),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_order_item_services_id"),
        "order_item_services",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_order_item_services_order_item_id",
        "order_item_services",
        ["order_item_id"],
        unique=False,
    )

    op.execute(
        sa.text(
            """
            INSERT INTO order_items (
                order_id,
                product_id,
                size_id,
                color,
                quantity_requested,
                notes,
                created_at
            )
            SELECT
                id,
                product_id,
                size_id,
                color,
                quantity_requested,
                notes,
                created_at
            FROM orders
            WHERE NOT EXISTS (
                SELECT 1
                FROM order_items
                WHERE order_items.order_id = orders.id
            )
            """
        )
    )

    op.execute(
        sa.text(
            """
            INSERT INTO order_item_services (
                order_item_id,
                service_id,
                quantity,
                unit_price,
                total_price,
                created_at
            )
            SELECT
                order_items.id,
                order_services.service_id,
                order_services.quantity,
                order_services.unit_price,
                order_services.total_price,
                order_services.created_at
            FROM order_services
            JOIN order_items ON order_items.order_id = order_services.order_id
            WHERE NOT EXISTS (
                SELECT 1
                FROM order_item_services
                WHERE
                    order_item_services.order_item_id = order_items.id
                    AND order_item_services.service_id = order_services.service_id
                    AND order_item_services.created_at = order_services.created_at
            )
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_order_item_services_order_item_id", table_name="order_item_services")
    op.drop_index(op.f("ix_order_item_services_id"), table_name="order_item_services")
    op.drop_table("order_item_services")
    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_index(op.f("ix_order_items_id"), table_name="order_items")
    op.drop_table("order_items")
