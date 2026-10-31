from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta
from typing import Any
from sqlalchemy.orm import Session

from app.models.account import CustomerAccount
from app.models.device import DeviceFingerprint
from app.models.transaction import Transaction
from app.services.features import extract_features, feature_vector_for_model
from app.services.ml import train_anomaly_model
from app.services.scoring import score_and_assess_transaction

INDIAN_BANKS = [
    ("State Bank of India", "@okhdfcbank"),
    ("HDFC Bank", "@okhdfcbank"),
    ("ICICI Bank", "@okicici"),
    ("Axis Bank", "@okaxis"),
    ("Kotak Mahindra Bank", "@kotak"),
    ("Punjab National Bank", "@pnb"),
    ("Bank of Baroda", "@barodampay"),
]

REGIONS = [
    "Mumbai, MH",
    "Bengaluru, KA",
    "Delhi, DL",
    "Hyderabad, TS",
    "Pune, MH",
    "Kolkata, WB",
    "Chennai, TN",
    "Ahmedabad, GJ",
    "Jaipur, RJ",
    "Lucknow, UP",
]

FIRST_NAMES = [
    "Aarav", "Vihaan", "Aditya", "Rohan", "Kabir", "Arjun", "Kunal", "Vikram",
    "Siddharth", "Rahul", "Ananya", "Diya", "Sanya", "Pooja", "Priya", "Ishaan",
    "Neha", "Tanvi", "Meera", "Shruti", "Akash", "Deepak", "Manish", "Gaurav"
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Iyer", "Nair", "Reddy", "Gupta", "Singh",
    "Chopra", "Joshi", "Bhatia", "Deshmukh", "Mehta", "Kulkarni", "Malhotra"
]

DEVICE_MODELS = [
    ("Samsung Galaxy S24", "Android 14"),
    ("iPhone 15 Pro", "iOS 17.5"),
    ("OnePlus 12", "OxygenOS 14"),
    ("Redmi Note 13", "Android 13"),
    ("Vivo V29", "Android 14"),
    ("Google Pixel 8", "Android 14"),
]

SCAM_NOTES = [
    "Electricity Bill Disconnection Avoid Fast",
    "Lottery Prize Claim Tax Fee",
    "KYC Verification Token Deposit",
    "Part Time Task Bonus Payout",
    "Customs Clearance International Package",
    "Refund from BillDesk Portal",
    "Double Money Crypto Plan",
]

PHISHING_HANDLES = [
    "sbi.kyc.verification@paytm",
    "electricity.desk@okaxis",
    "hdfc.support.refund@upi",
    "fastag.toll.clearance@ybl",
    "billdesk.refund.claim@paytm",
]


def generate_synthetic_dataset(
    db: Session,
    account_count: int = 40,
    transaction_count: int = 150,
    seed: int | None = 42,
) -> dict[str, Any]:
    """
    Generate synthetic customer profiles, devices, historical transactions,
    UPI fraud risk typologies, and train the Isolation Forest model.
    """
    if seed is not None:
        random.seed(seed)
    # 1. Create Synthetic Accounts
    accounts: list[CustomerAccount] = []
    devices: list[DeviceFingerprint] = []

    for i in range(1, account_count + 1):
        bank_name, vpa_suffix = random.choice(INDIAN_BANKS)
        fname = random.choice(FIRST_NAMES)
        lname = random.choice(LAST_NAMES)
        account_id = f"ACC_IND_{1000 + i}"
        upi_handle = f"{fname.lower()}.{lname.lower()}{random.randint(10, 99)}{vpa_suffix}"
        device_id = f"DEV_IND_{random.randint(100000, 999999)}"
        dev_model, dev_os = random.choice(DEVICE_MODELS)
        geo = random.choice(REGIONS)
        baseline_amt = round(random.uniform(800.0, 7500.0), 2)

        # Check existing
        existing_acc = db.query(CustomerAccount).filter(CustomerAccount.account_id == account_id).first()
        if not existing_acc:
            acc = CustomerAccount(
                account_id=account_id,
                holder_name=f"{fname} {lname}",
                account_number_masked=f"XXXX-XXXX-{random.randint(1000, 9999)}",
                bank_name=bank_name,
                primary_upi_handle=upi_handle,
                primary_device_id=device_id,
                primary_geo_region=geo,
                baseline_avg_amount=baseline_amt,
                baseline_daily_velocity=round(random.uniform(1.0, 5.0), 1),
                risk_tier="STANDARD",
            )
            db.add(acc)
            accounts.append(acc)
        else:
            accounts.append(existing_acc)

        existing_dev = db.query(DeviceFingerprint).filter(DeviceFingerprint.device_id == device_id).first()
        if not existing_dev:
            dev = DeviceFingerprint(
                device_id=device_id,
                device_model=dev_model,
                os_version=dev_os,
                app_version="v4.8.2",
            )
            db.add(dev)
            devices.append(dev)
        else:
            devices.append(existing_dev)

    db.commit()

    # 2. Generate Historical Synthetic Transactions across past 7 days
    now = datetime.utcnow()
    feature_matrix: list[list[float]] = []
    generated_txns: list[Transaction] = []

    # Dedicated Fraud Ring Accounts
    mule_account = accounts[0]
    victim_account = accounts[1]
    shared_device_id = "DEV_SHARED_RING_998877"

    for i in range(1, transaction_count + 1):
        sender = random.choice(accounts)
        receiver = random.choice(accounts)
        while receiver.account_id == sender.account_id:
            receiver = random.choice(accounts)

        # 85% normal baseline, 15% synthetic anomaly patterns
        is_anomaly = (i % 7 == 0)
        days_ago = random.uniform(0.1, 7.0)
        tx_time = now - timedelta(days=days_ago)

        if not is_anomaly:
            # Normal baseline transaction
            amount = round(random.uniform(50.0, sender.baseline_avg_amount * 1.5), 2)
            tx_type = "pay"
            channel = "upi_app"
            note = random.choice(["Dinner", "Rent split", "Grocery", "Recharge", "Book purchase", None])
            device_id = sender.primary_device_id
            geo = sender.primary_geo_region
            synthetic_ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
            receiver_handle = receiver.primary_upi_handle
            is_fraud = False
            typology = "normal"
        else:
            is_fraud = True
            # Specific UPI Fraud Typologies
            typology = random.choice([
                "fake_collect",
                "phishing_handle",
                "mule_fanout",
                "velocity_burst",
                "new_payee_high_value",
                "device_ring",
                "round_amount",
                "geo_night",
            ])

            if typology == "fake_collect":
                amount = round(float(random.choice([4999, 9999, 14999, 25000])), 2)
                tx_type = "collect"
                channel = "collect_request"
                note = random.choice(SCAM_NOTES)
                device_id = f"DEV_COLLECT_{random.randint(100, 999)}"
                geo = random.choice(REGIONS)
                synthetic_ip = f"185.220.{random.randint(10, 240)}.{random.randint(1, 250)}"
                receiver_handle = random.choice(PHISHING_HANDLES)

            elif typology == "phishing_handle":
                amount = round(random.uniform(5000.0, 35000.0), 2)
                tx_type = "pay"
                channel = "web_portal"
                note = "KYC update verification fee"
                device_id = sender.primary_device_id
                geo = sender.primary_geo_region
                synthetic_ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
                receiver_handle = random.choice(PHISHING_HANDLES)

            elif typology == "mule_fanout":
                sender = mule_account
                amount = round(random.uniform(25000.0, 75000.0), 2)
                tx_type = "transfer"
                channel = "upi_app"
                note = "urgent fund forward"
                device_id = sender.primary_device_id
                geo = sender.primary_geo_region
                synthetic_ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
                receiver_handle = receiver.primary_upi_handle

            elif typology == "velocity_burst":
                amount = round(random.uniform(1000.0, 5000.0), 2)
                tx_type = "pay"
                channel = "upi_app"
                note = "flash payment"
                device_id = sender.primary_device_id
                geo = sender.primary_geo_region
                synthetic_ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
                receiver_handle = receiver.primary_upi_handle

            elif typology == "new_payee_high_value":
                amount = round(sender.baseline_avg_amount * random.uniform(6.0, 10.0), 2)
                tx_type = "pay"
                channel = "upi_app"
                note = "property advance token"
                device_id = sender.primary_device_id
                geo = random.choice(REGIONS)
                synthetic_ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
                receiver_handle = receiver.primary_upi_handle

            elif typology == "device_ring":
                amount = round(random.uniform(15000.0, 49999.0), 2)
                tx_type = "pay"
                channel = "upi_app"
                note = "cash settlement"
                device_id = shared_device_id
                geo = "Delhi, DL"
                synthetic_ip = "192.168.10.45"
                receiver_handle = receiver.primary_upi_handle

            elif typology == "round_amount":
                amount = float(random.choice([10000, 20000, 50000, 100000]))
                tx_type = "pay"
                channel = "upi_app"
                note = "round lot settlement"
                device_id = sender.primary_device_id
                geo = sender.primary_geo_region
                synthetic_ip = f"103.21.{random.randint(10, 240)}.{random.randint(1, 250)}"
                receiver_handle = receiver.primary_upi_handle

            else:  # geo_night
                amount = round(sender.baseline_avg_amount * random.uniform(3.0, 6.0), 2)
                tx_type = "pay"
                channel = "upi_app"
                note = "late night transfer"
                device_id = sender.primary_device_id
                # Force time to 2-4 AM
                tx_time = tx_time.replace(hour=random.choice([2, 3, 4]), minute=random.randint(0, 59))
                geo = "Guwahati, AS"  # Discrepant geo
                synthetic_ip = "45.154.255.88"
                receiver_handle = receiver.primary_upi_handle

        txn, assessment, _ = score_and_assess_transaction(
            db=db,
            amount=amount,
            sender_account_id=sender.account_id,
            receiver_account_id=receiver.account_id,
            sender_upi_handle=sender.primary_upi_handle,
            receiver_upi_handle=receiver_handle,
            device_id=device_id,
            synthetic_ip=synthetic_ip,
            synthetic_geo_region=geo,
            transaction_type=tx_type,
            channel=channel,
            reference_note=note,
            timestamp=tx_time,
            persist=True,
            is_fraud_synthetic=is_fraud,
            fraud_typology=typology,
            transaction_id_str=f"UPI/{tx_time.strftime('%Y%m%d%H%M')}/{100000 + i}_{uuid.uuid4().hex[:4].upper()}",
        )
        generated_txns.append(txn)

        # Collect features for model training
        if assessment and assessment.feature_snapshot:
            feature_matrix.append(feature_vector_for_model(assessment.feature_snapshot))

    # 3. Train the Isolation Forest Model on the generated dataset
    model_result = {"status": "skipped", "reason": "insufficient samples"}
    if len(feature_matrix) >= 15:
        model_result = train_anomaly_model(feature_matrix)

    return {
        "status": "success",
        "accounts_created": len(accounts),
        "transactions_generated": len(generated_txns),
        "model_training": model_result,
    }

