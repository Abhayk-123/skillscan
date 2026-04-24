import hmac
import hashlib
from flask import current_app


def _payment_configured() -> bool:
    return bool(current_app.config.get("RAZORPAY_KEY_ID") and current_app.config.get("RAZORPAY_KEY_SECRET"))


def _get_client():
    if not _payment_configured():
        raise RuntimeError("Payment is paused. Add Razorpay keys to enable checkout.")
    try:
        import razorpay
    except Exception as exc:
        raise RuntimeError("Razorpay SDK is not ready. Install dependencies and retry.") from exc
    return razorpay.Client(
        auth=(
            current_app.config.get("RAZORPAY_KEY_ID", ""),
            current_app.config.get("RAZORPAY_KEY_SECRET", ""),
        )
    )


def create_order(amount_paise: int, receipt: str):
    client = _get_client()
    return client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,
    })


def create_plan(period: str, interval_count: int, amount_paise: int, name: str, description: str = "", currency: str = "INR"):
    client = _get_client()
    return client.plan.create({
        "period": period,
        "interval": interval_count,
        "item": {
            "name": name,
            "amount": amount_paise,
            "currency": currency,
            "description": description,
        },
    })


def create_subscription(plan_id: str, total_count: int = 12, customer_notify: int = 1):
    client = _get_client()
    return client.subscription.create({
        "plan_id": plan_id,
        "customer_notify": customer_notify,
        "total_count": total_count,
    })


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    secret = current_app.config.get("RAZORPAY_KEY_SECRET", "")
    if not secret:
        return False
    body = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    secret = current_app.config.get("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
