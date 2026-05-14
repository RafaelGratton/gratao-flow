"""employee daily hours and individual weekly closings

Revision ID: 202605010019
Revises: 202605010018
Create Date: 2026-05-14 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605010019"
down_revision: str | None = "202605010018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

work_payment_mode_enum = postgresql.ENUM(
    "full_day",
    "proportional_hours",
    name="employee_work_payment_mode",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    work_payment_mode_enum.create(bind, checkfirst=True)
    op.execute("ALTER TYPE weekly_closing_status ADD VALUE IF NOT EXISTS 'paid'")

    op.add_column("employees", sa.Column("role", sa.String(length=120), nullable=True))
    op.add_column(
        "employees",
        sa.Column(
            "standard_daily_hours",
            sa.Numeric(5, 2),
            server_default="8.00",
            nullable=False,
        ),
    )
    op.add_column(
        "employees",
        sa.Column(
            "standard_lunch_hours",
            sa.Numeric(5, 2),
            server_default="1.00",
            nullable=False,
        ),
    )
    op.add_column("employees", sa.Column("notes", sa.Text(), nullable=True))

    op.add_column("employee_work_logs", sa.Column("clock_in", sa.Time(), nullable=True))
    op.add_column("employee_work_logs", sa.Column("clock_out", sa.Time(), nullable=True))
    op.add_column(
        "employee_work_logs",
        sa.Column("break_hours", sa.Numeric(5, 2), server_default="1.00", nullable=False),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column("gross_hours", sa.Numeric(5, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column("net_hours", sa.Numeric(5, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column("regular_hours", sa.Numeric(5, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column("overtime_hours", sa.Numeric(5, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column(
            "payment_mode",
            work_payment_mode_enum,
            server_default="full_day",
            nullable=False,
        ),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column("base_amount", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column("overtime_amount", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column("total_amount", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "employee_work_logs",
        sa.Column("weekly_closing_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_employee_work_logs_weekly_closing_id_weekly_closings",
        "employee_work_logs",
        "weekly_closings",
        ["weekly_closing_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_employee_work_logs_weekly_closing_id"),
        "employee_work_logs",
        ["weekly_closing_id"],
        unique=False,
    )

    op.execute(
        """
        UPDATE employee_work_logs
        SET base_amount = amount,
            total_amount = amount
        """
    )

    op.add_column("weekly_closings", sa.Column("employee_id", sa.Integer(), nullable=True))
    op.add_column(
        "weekly_closings",
        sa.Column("days_worked", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("total_gross_hours", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("total_break_hours", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("total_net_hours", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("total_regular_hours", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("total_overtime_hours", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("total_base_amount", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("total_overtime_amount", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("discounts", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("advances", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column(
        "weekly_closings",
        sa.Column("total_payable", sa.Numeric(10, 2), server_default="0.00", nullable=False),
    )
    op.add_column("weekly_closings", sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_weekly_closings_employee_id_employees",
        "weekly_closings",
        "employees",
        ["employee_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_weekly_closings_employee_id"),
        "weekly_closings",
        ["employee_id"],
        unique=False,
    )

    op.alter_column("employees", "standard_daily_hours", server_default=None)
    op.alter_column("employees", "standard_lunch_hours", server_default=None)
    op.alter_column("employee_work_logs", "break_hours", server_default=None)
    op.alter_column("employee_work_logs", "gross_hours", server_default=None)
    op.alter_column("employee_work_logs", "net_hours", server_default=None)
    op.alter_column("employee_work_logs", "regular_hours", server_default=None)
    op.alter_column("employee_work_logs", "overtime_hours", server_default=None)
    op.alter_column("employee_work_logs", "payment_mode", server_default=None)
    op.alter_column("employee_work_logs", "base_amount", server_default=None)
    op.alter_column("employee_work_logs", "overtime_amount", server_default=None)
    op.alter_column("employee_work_logs", "total_amount", server_default=None)
    op.alter_column("weekly_closings", "days_worked", server_default=None)
    op.alter_column("weekly_closings", "total_gross_hours", server_default=None)
    op.alter_column("weekly_closings", "total_break_hours", server_default=None)
    op.alter_column("weekly_closings", "total_net_hours", server_default=None)
    op.alter_column("weekly_closings", "total_regular_hours", server_default=None)
    op.alter_column("weekly_closings", "total_overtime_hours", server_default=None)
    op.alter_column("weekly_closings", "total_base_amount", server_default=None)
    op.alter_column("weekly_closings", "total_overtime_amount", server_default=None)
    op.alter_column("weekly_closings", "discounts", server_default=None)
    op.alter_column("weekly_closings", "advances", server_default=None)
    op.alter_column("weekly_closings", "total_payable", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_index(op.f("ix_weekly_closings_employee_id"), table_name="weekly_closings")
    op.drop_constraint(
        "fk_weekly_closings_employee_id_employees",
        "weekly_closings",
        type_="foreignkey",
    )
    op.drop_column("weekly_closings", "paid_at")
    op.drop_column("weekly_closings", "total_payable")
    op.drop_column("weekly_closings", "advances")
    op.drop_column("weekly_closings", "discounts")
    op.drop_column("weekly_closings", "total_overtime_amount")
    op.drop_column("weekly_closings", "total_base_amount")
    op.drop_column("weekly_closings", "total_overtime_hours")
    op.drop_column("weekly_closings", "total_regular_hours")
    op.drop_column("weekly_closings", "total_net_hours")
    op.drop_column("weekly_closings", "total_break_hours")
    op.drop_column("weekly_closings", "total_gross_hours")
    op.drop_column("weekly_closings", "days_worked")
    op.drop_column("weekly_closings", "employee_id")

    op.drop_index(op.f("ix_employee_work_logs_weekly_closing_id"), table_name="employee_work_logs")
    op.drop_constraint(
        "fk_employee_work_logs_weekly_closing_id_weekly_closings",
        "employee_work_logs",
        type_="foreignkey",
    )
    op.drop_column("employee_work_logs", "weekly_closing_id")
    op.drop_column("employee_work_logs", "total_amount")
    op.drop_column("employee_work_logs", "overtime_amount")
    op.drop_column("employee_work_logs", "base_amount")
    op.drop_column("employee_work_logs", "payment_mode")
    op.drop_column("employee_work_logs", "overtime_hours")
    op.drop_column("employee_work_logs", "regular_hours")
    op.drop_column("employee_work_logs", "net_hours")
    op.drop_column("employee_work_logs", "gross_hours")
    op.drop_column("employee_work_logs", "break_hours")
    op.drop_column("employee_work_logs", "clock_out")
    op.drop_column("employee_work_logs", "clock_in")

    op.drop_column("employees", "notes")
    op.drop_column("employees", "standard_lunch_hours")
    op.drop_column("employees", "standard_daily_hours")
    op.drop_column("employees", "role")

    work_payment_mode_enum.drop(bind, checkfirst=True)
