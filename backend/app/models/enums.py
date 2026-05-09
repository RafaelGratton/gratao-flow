from enum import StrEnum


class ProductionStatus(StrEnum):
    CREATED = "created"
    IN_CUT = "in_cut"
    CUT_DONE = "cut_done"
    WAITING_PRINT = "waiting_print"
    IN_PRINT = "in_print"
    PRINT_DONE = "print_done"
    WAITING_SEWING = "waiting_sewing"
    IN_SEWING = "in_sewing"
    SEWING_DONE = "sewing_done"
    OUTSOURCED = "outsourced"
    RETURNED = "returned"
    READY = "ready"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class FinancialStatus(StrEnum):
    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"


class PaymentMethod(StrEnum):
    PIX = "pix"
    CASH = "cash"
    CARD = "card"
    BOLETO = "boleto"


class PrintType(StrEnum):
    FRONT = "front"
    FRONT_BACK = "front_back"


class SewingMode(StrEnum):
    INTERNAL = "internal"
    OUTSOURCED = "outsourced"


class ProductionEventType(StrEnum):
    CUT_REGISTERED = "cut_registered"
    PRINT_REGISTERED = "print_registered"
    SEWING_REGISTERED = "sewing_registered"
    OUTSOURCING_SENT = "outsourcing_sent"
    OUTSOURCING_RETURNED = "outsourcing_returned"
    OUTSOURCING_PAYOUT_PAID = "outsourcing_payout_paid"
    STATUS_CHANGED = "status_changed"


class OutsourcingStatus(StrEnum):
    SENT = "sent"
    PARTIALLY_RETURNED = "partially_returned"
    RETURNED = "returned"
    DELIVERED_DIRECT = "delivered_direct"
    CANCELLED = "cancelled"


class PayoutStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"


class WorkType(StrEnum):
    FULL_DAY = "full_day"
    HALF_DAY = "half_day"
    ABSENCE = "absence"


class EmployeePaymentStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"


class WeeklyClosingStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class StockCategory(StrEnum):
    MATERIAL = "material"
    PIECE = "piece"


class StockMovementType(StrEnum):
    ENTRY = "entry"
    EXIT = "exit"
    ADJUSTMENT = "adjustment"
    EXCESS_CUT = "excess_cut"
    LOSS = "loss"
