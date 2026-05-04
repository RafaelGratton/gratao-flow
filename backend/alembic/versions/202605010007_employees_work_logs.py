"""employees and work logs

Revision ID: 202605010007
Revises: 202605010006
Create Date: 2026-05-03 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605010007"
down_revision: str | None = "202605010006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

work_type_enum = postgresql.ENUM(
    "full_day",
    "half_day",
    "absence",
    name="work_type",
    create_type=False,
)
employee_payment_status_enum = postgresql.ENUM(
    "pending",
    "paid",
    name="employee_payment_status",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    work_type_enum.create(bind, checkfirst=True)
    employee_payment_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("daily_rate", sa.Numeric(10, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_employees_id"), "employees", ["id"], unique=False)

    op.create_table(
        "employee_work_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("work_type", work_type_enum, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "payment_status",
            employee_payment_status_enum,
            server_default="pending",
            nullable=False,
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "employee_id",
            "work_date",
            name="uq_employee_work_logs_employee_date",
        ),
    )
    op.create_index(op.f("ix_employee_work_logs_id"), "employee_work_logs", ["id"], unique=False)

    op.alter_column("employees", "is_active", server_default=None)
    op.alter_column("employee_work_logs", "payment_status", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index(op.f("ix_employee_work_logs_id"), table_name="employee_work_logs")
    op.drop_table("employee_work_logs")
    op.drop_index(op.f("ix_employees_id"), table_name="employees")
    op.drop_table("employees")

    employee_payment_status_enum.drop(bind, checkfirst=True)
    work_type_enum.drop(bind, checkfirst=True)
