"""stock module

Revision ID: 202605010005
Revises: 202605010004
Create Date: 2026-05-02 01:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605010005"
down_revision: str | None = "202605010004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

stock_category_enum = postgresql.ENUM(
    "material",
    "piece",
    name="stock_category",
    create_type=False,
)
stock_movement_type_enum = postgresql.ENUM(
    "entry",
    "exit",
    "adjustment",
    "excess_cut",
    "loss",
    name="stock_movement_type",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    stock_category_enum.create(bind, checkfirst=True)
    stock_movement_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "stock_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category", stock_category_enum, nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("size_id", sa.Integer(), nullable=True),
        sa.Column("color", sa.String(length=100), nullable=True),
        sa.Column("unit", sa.String(length=30), nullable=False),
        sa.Column(
            "quantity",
            sa.Numeric(10, 2),
            server_default="0.00",
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["size_id"], ["sizes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_stock_items_id"), "stock_items", ["id"], unique=False)
    op.create_index(
        "ix_stock_items_piece_identity",
        "stock_items",
        ["category", "product_id", "size_id", "color"],
        unique=False,
    )

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stock_item_id", sa.Integer(), nullable=False),
        sa.Column("movement_type", stock_movement_type_enum, nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("previous_quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("new_quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["stock_item_id"], ["stock_items.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_stock_movements_id"), "stock_movements", ["id"], unique=False
    )
    op.create_index(
        "ix_stock_movements_stock_item_id_created_at",
        "stock_movements",
        ["stock_item_id", "created_at"],
        unique=False,
    )

    op.alter_column("stock_items", "quantity", server_default=None)
    op.alter_column("stock_items", "is_active", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index(
        "ix_stock_movements_stock_item_id_created_at", table_name="stock_movements"
    )
    op.drop_index(op.f("ix_stock_movements_id"), table_name="stock_movements")
    op.drop_table("stock_movements")
    op.drop_index("ix_stock_items_piece_identity", table_name="stock_items")
    op.drop_index(op.f("ix_stock_items_id"), table_name="stock_items")
    op.drop_table("stock_items")

    stock_movement_type_enum.drop(bind, checkfirst=True)
    stock_category_enum.drop(bind, checkfirst=True)
