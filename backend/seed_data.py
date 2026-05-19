import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models import Zone, Asset

ZONES = [
    {"name": "Zone A — Bay 1", "description": "Primary maintenance bay", "zone_type": "maintenance"},
    {"name": "Zone B — Bay 2", "description": "Secondary maintenance bay", "zone_type": "maintenance"},
    {"name": "Zone C — Tool Crib", "description": "Controlled tool storage and checkout", "zone_type": "storage"},
    {"name": "Zone D — Parts Storage", "description": "Replacement parts and consumables", "zone_type": "storage"},
    {"name": "Zone E — Ready Line", "description": "Assets staged for deployment", "zone_type": "operations"},
    {"name": "Zone F — Admin", "description": "Administrative offices and planning", "zone_type": "admin"},
    {"name": "Zone G — Hangar Floor", "description": "Main hangar work area", "zone_type": "operations"},
    {"name": "Zone H — Outside/Transit", "description": "External staging and transit area", "zone_type": "transit"},
]

ASSET_TEMPLATES = [
    # Tools
    {"name": "Torque Wrench", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Digital Multimeter", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Hydraulic Jack", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Oscilloscope", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Pneumatic Drill", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Rivet Gun", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Heat Gun", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Wire Crimper", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Borescope", "category": "Tool", "compliance_type": "Calibration Status"},
    {"name": "Tension Meter", "category": "Tool", "compliance_type": "Calibration Status"},
    # Safety Equipment
    {"name": "Fire Extinguisher", "category": "Safety", "compliance_type": "Fire Protection"},
    {"name": "Spill Kit", "category": "Safety", "compliance_type": "Fire Protection"},
    {"name": "First Aid Kit", "category": "Safety", "compliance_type": "Fire Protection"},
    {"name": "Eye Wash Station", "category": "Safety", "compliance_type": "Fire Protection"},
    {"name": "Fire Blanket", "category": "Safety", "compliance_type": "Fire Protection"},
    # Fall Protection
    {"name": "Safety Harness", "category": "Fall Protection", "compliance_type": "Fall Protection"},
    {"name": "Lanyard", "category": "Fall Protection", "compliance_type": "Fall Protection"},
    {"name": "Retractable Lifeline", "category": "Fall Protection", "compliance_type": "Fall Protection"},
    {"name": "Anchor Point Kit", "category": "Fall Protection", "compliance_type": "Fall Protection"},
    # Lockout/Tagout
    {"name": "Lockout Hasp", "category": "LOTO", "compliance_type": "Lockout/Tagout"},
    {"name": "Circuit Breaker Lock", "category": "LOTO", "compliance_type": "Lockout/Tagout"},
    {"name": "Valve Lockout Device", "category": "LOTO", "compliance_type": "Lockout/Tagout"},
    {"name": "Tagout Kit", "category": "LOTO", "compliance_type": "Lockout/Tagout"},
    # Support Equipment
    {"name": "Portable Generator", "category": "Support Equipment", "compliance_type": "Calibration Status"},
    {"name": "Air Compressor", "category": "Support Equipment", "compliance_type": "Calibration Status"},
    {"name": "Welding Machine", "category": "Support Equipment", "compliance_type": "Calibration Status"},
    {"name": "Forklift", "category": "Support Equipment", "compliance_type": "Calibration Status"},
    {"name": "Tow Bar", "category": "Support Equipment", "compliance_type": "Calibration Status"},
    {"name": "Hydraulic Test Stand", "category": "Support Equipment", "compliance_type": "Calibration Status"},
    {"name": "Nitrogen Cart", "category": "Support Equipment", "compliance_type": "Calibration Status"},
]

OWNERS = [
    "J. Martinez", "R. Chen", "S. Patel", "M. Johnson", "K. Williams",
    "D. Thompson", "A. Garcia", "L. Brown", "T. Davis", "N. Wilson",
    "C. Anderson", "P. Taylor", "B. Thomas", "E. Jackson", "F. White",
]

STATUSES = ["active", "active", "active", "active", "inactive", "maintenance"]

NOTES_TEMPLATES = [
    "Calibration due {date}",
    "Annual inspection due {date}",
    "Last serviced {date}",
    "Replacement ordered — ETA {date}",
    "Checked out by {owner}",
    "Returned to service {date}",
    "Pending safety review",
    "",
]


def generate_note():
    template = random.choice(NOTES_TEMPLATES)
    if not template:
        return ""
    future_date = datetime.utcnow() + timedelta(days=random.randint(7, 180))
    return template.format(
        date=future_date.strftime("%Y-%m-%d"),
        owner=random.choice(OWNERS),
    )


def seed_database(db: Session):
    if db.query(Zone).count() > 0:
        return

    zones = []
    for zone_data in ZONES:
        zone = Zone(**zone_data)
        db.add(zone)
        zones.append(zone)
    db.flush()

    for i in range(75):
        template = random.choice(ASSET_TEMPLATES)
        zone = random.choice(zones)
        status = random.choice(STATUSES)
        compliant = random.random() > 0.15

        asset = Asset(
            asset_tag=f"VGL-{i + 1:04d}",
            name=template["name"],
            category=template["category"],
            status=status,
            owner=random.choice(OWNERS),
            last_seen=datetime.utcnow() - timedelta(minutes=random.randint(1, 4320)),
            compliant=compliant,
            compliance_type=template["compliance_type"],
            notes=generate_note(),
            zone_id=zone.id,
        )
        db.add(asset)

    db.commit()
