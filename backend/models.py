from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255))
    zone_type = Column(String(50))

    assets = relationship("Asset", back_populates="zone")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="active")
    owner = Column(String(100))
    last_seen = Column(DateTime, default=datetime.utcnow)
    compliant = Column(Boolean, default=True)
    compliance_type = Column(String(50))
    notes = Column(Text)

    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    zone = relationship("Zone", back_populates="assets")
