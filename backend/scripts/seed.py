"""Seed data: populate DB with Indian EV stations and vehicle profiles."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import AsyncSessionLocal, engine, Base
from app.models.models import Station, VehicleProfile, User, UserRole
from app.core.security import get_password_hash
import uuid


SEED_STATIONS = [
    {
        "name": "Tata Power EV Hub - Connaught Place",
        "operator": "Tata Power",
        "address": "Connaught Place Inner Circle",
        "city": "Delhi",
        "state": "Delhi",
        "latitude": 28.6315,
        "longitude": 77.2167,
        "charger_types": ["dc_fast", "ac_fast"],
        "total_slots": 4,
        "available_slots": 2,
        "max_power_kw": 50.0,
        "trust_score": 0.85,
        "is_open": True,
        "is_verified": True,
    },
    {
        "name": "Ather Grid - Koramangala",
        "operator": "Ather Energy",
        "address": "80 Feet Road, Koramangala",
        "city": "Bangalore",
        "state": "Karnataka",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "charger_types": ["ac_fast"],
        "total_slots": 6,
        "available_slots": 4,
        "max_power_kw": 7.4,
        "trust_score": 0.90,
        "is_open": True,
        "is_verified": True,
    },
    {
        "name": "BPCL EV Station - BKC",
        "operator": "BPCL",
        "address": "Bandra Kurla Complex",
        "city": "Mumbai",
        "state": "Maharashtra",
        "latitude": 19.0607,
        "longitude": 72.8661,
        "charger_types": ["dc_fast", "ac_slow"],
        "total_slots": 3,
        "available_slots": 1,
        "max_power_kw": 60.0,
        "trust_score": 0.75,
        "is_open": True,
        "is_verified": True,
    },
    {
        "name": "ChargeZone - Hitech City",
        "operator": "ChargeZone",
        "address": "HITEC City, Madhapur",
        "city": "Hyderabad",
        "state": "Telangana",
        "latitude": 17.4435,
        "longitude": 78.3772,
        "charger_types": ["dc_fast"],
        "total_slots": 5,
        "available_slots": 3,
        "max_power_kw": 150.0,
        "trust_score": 0.88,
        "is_open": True,
        "is_verified": True,
    },
    {
        "name": "MG Motors Charging Hub - Salt Lake",
        "operator": "MG Motor India",
        "address": "Sector V, Salt Lake City",
        "city": "Kolkata",
        "state": "West Bengal",
        "latitude": 22.5726,
        "longitude": 88.4313,
        "charger_types": ["dc_fast", "ac_fast"],
        "total_slots": 4,
        "available_slots": 2,
        "max_power_kw": 76.0,
        "trust_score": 0.82,
        "is_open": True,
        "is_verified": True,
    },
    {
        "name": "EV Grid - Jubilee Hills",
        "operator": "EV Grid",
        "address": "Road 36, Jubilee Hills",
        "city": "Hyderabad",
        "state": "Telangana",
        "latitude": 17.4239,
        "longitude": 78.4070,
        "charger_types": ["ac_fast"],
        "total_slots": 3,
        "available_slots": 3,
        "max_power_kw": 22.0,
        "trust_score": 0.70,
        "is_open": True,
        "is_verified": False,
    },
    {
        "name": "Servotech EV - Nehru Place",
        "operator": "Servotech",
        "address": "Nehru Place Market",
        "city": "Delhi",
        "state": "Delhi",
        "latitude": 28.5488,
        "longitude": 77.2512,
        "charger_types": ["dc_fast"],
        "total_slots": 2,
        "available_slots": 0,
        "max_power_kw": 50.0,
        "trust_score": 0.60,
        "is_open": True,
        "is_verified": False,
    },
    {
        "name": "Tata Power - Phoenix Marketcity",
        "operator": "Tata Power",
        "address": "Phoenix Marketcity, Kurla",
        "city": "Mumbai",
        "state": "Maharashtra",
        "latitude": 19.0875,
        "longitude": 72.8884,
        "charger_types": ["ac_fast", "dc_fast"],
        "total_slots": 8,
        "available_slots": 5,
        "max_power_kw": 50.0,
        "trust_score": 0.92,
        "is_open": True,
        "is_verified": True,
    },
    {
        "name": "Bounce Infinity - Whitefield",
        "operator": "Bounce Infinity",
        "address": "Whitefield Main Road",
        "city": "Bangalore",
        "state": "Karnataka",
        "latitude": 12.9698,
        "longitude": 77.7499,
        "charger_types": ["ac_slow"],
        "total_slots": 10,
        "available_slots": 7,
        "max_power_kw": 3.3,
        "trust_score": 0.65,
        "is_open": True,
        "is_verified": False,
    },
    {
        "name": "Zeon EV - Vadodara",
        "operator": "Zeon Charging",
        "address": "Alkapuri Society",
        "city": "Vadodara",
        "state": "Gujarat",
        "latitude": 22.3119,
        "longitude": 73.1723,
        "charger_types": ["dc_fast"],
        "total_slots": 3,
        "available_slots": 2,
        "max_power_kw": 60.0,
        "trust_score": 0.78,
        "is_open": True,
        "is_verified": True,
    },
]

SEED_VEHICLES = [
    {
        "brand": "Tata",
        "model": "Nexon EV",
        "battery_capacity_kwh": 40.5,
        "usable_capacity_kwh": 37.5,
        "efficiency_wh_per_km": 155,
        "drag_coefficient": 0.36,
        "frontal_area_m2": 2.35,
        "mass_kg": 1580,
        "rolling_resistance": 0.012,
        "max_regen_power_kw": 50,
        "hvac_power_kw": 2.2,
        "max_charge_rate_kw": 50,
        "connector_types": ["CCS2", "Type2"],
    },
    {
        "brand": "Tata",
        "model": "Tiago EV",
        "battery_capacity_kwh": 24.0,
        "usable_capacity_kwh": 21.5,
        "efficiency_wh_per_km": 115,
        "drag_coefficient": 0.34,
        "frontal_area_m2": 2.10,
        "mass_kg": 1175,
        "rolling_resistance": 0.011,
        "max_regen_power_kw": 35,
        "hvac_power_kw": 1.8,
        "max_charge_rate_kw": 25,
        "connector_types": ["Type2", "CCS2"],
    },
    {
        "brand": "MG",
        "model": "ZS EV",
        "battery_capacity_kwh": 50.3,
        "usable_capacity_kwh": 46.8,
        "efficiency_wh_per_km": 175,
        "drag_coefficient": 0.38,
        "frontal_area_m2": 2.55,
        "mass_kg": 1620,
        "rolling_resistance": 0.013,
        "max_regen_power_kw": 70,
        "hvac_power_kw": 2.5,
        "max_charge_rate_kw": 76,
        "connector_types": ["CCS2", "CHAdeMO"],
    },
    {
        "brand": "BYD",
        "model": "Atto 3",
        "battery_capacity_kwh": 60.5,
        "usable_capacity_kwh": 56.6,
        "efficiency_wh_per_km": 165,
        "drag_coefficient": 0.29,
        "frontal_area_m2": 2.52,
        "mass_kg": 1750,
        "rolling_resistance": 0.011,
        "max_regen_power_kw": 100,
        "hvac_power_kw": 2.8,
        "max_charge_rate_kw": 88,
        "connector_types": ["CCS2"],
    },
]


async def seed():
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Seed vehicles
        print("Seeding vehicle profiles...")
        for v_data in SEED_VEHICLES:
            vp = VehicleProfile(**v_data)
            db.add(vp)

        # Seed stations
        print("Seeding charging stations...")
        for s_data in SEED_STATIONS:
            s = Station(**s_data)
            db.add(s)

        # Create admin user
        print("Creating admin user...")
        admin = User(
            name="GatiCharge Admin",
            email="admin@gaticharge.in",
            password_hash=get_password_hash("Admin@12345"),
            role=UserRole.admin,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)

        # Create demo user
        demo = User(
            name="Arjun Sharma",
            email="demo@gaticharge.in",
            password_hash=get_password_hash("Demo@12345"),
            role=UserRole.user,
            is_active=True,
            is_verified=True,
        )
        db.add(demo)

        await db.commit()
        print("✅ Seed data inserted successfully!")
        print("\nDemo Credentials:")
        print("  Admin: admin@gaticharge.in / Admin@12345")
        print("  User:  demo@gaticharge.in / Demo@12345")


if __name__ == "__main__":
    asyncio.run(seed())
