"""initial schema

Revision ID: 202605010001
Revises:
Create Date: 2026-05-01 22:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605010001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

production_status_enum = postgresql.ENUM(
    "created",
    "in_cut",
    "cut_done",
    "in_print",
    "print_done",
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
financial_status_enum = postgresql.ENUM(
    "pending",
    "partial",
    "paid",
    name="financial_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    production_status_enum.create(bind, checkfirst=True)
    financial_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "sizes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=20), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("label"),
    )

    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("price_per_unit", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("size_id", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(length=100), nullable=False),
        sa.Column("quantity_requested", sa.Integer(), nullable=False),
        sa.Column("quantity_cut", sa.Integer(), nullable=True),
        sa.Column("quantity_extra", sa.Integer(), nullable=False),
        sa.Column("lot", sa.String(length=100), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("production_status", production_status_enum, nullable=False),
        sa.Column("financial_status", financial_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["size_id"], ["sizes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_table("orders")
    op.drop_table("services")
    op.drop_table("sizes")
    op.drop_table("products")
    op.drop_table("clients")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    financial_status_enum.drop(bind, checkfirst=True)
    production_status_enum.drop(bind, checkfirst=True)
