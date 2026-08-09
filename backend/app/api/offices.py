from __future__ import annotations

import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.models import GovernmentOffice, User

router = APIRouter(prefix="/offices", tags=["offices"])


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def _office_out(o: GovernmentOffice, lat: float | None = None, lng: float | None = None) -> dict:
    d = {
        "id": o.id, "name": o.name, "type": o.type, "address": o.address,
        "state": o.state, "district": o.district, "lat": o.lat, "lng": o.lng,
        "phone": o.phone, "email": o.email, "working_hours": o.working_hours,
        "services": o.services, "rating": o.rating, "is_open": o.is_open,
        "distance_km": None,
    }
    if lat is not None and lng is not None:
        d["distance_km"] = haversine_km(lat, lng, o.lat, o.lng)
        d["directions_url"] = f"https://www.google.com/maps/dir/?api=1&destination={o.lat},{o.lng}"
    return d


@router.get("")
def list_offices(
    state: str | None = None,
    district: str | None = None,
    office_type: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = Query(100, ge=1),
    q: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(GovernmentOffice)
    if state:
        query = query.filter(GovernmentOffice.state == state)
    if district:
        query = query.filter(GovernmentOffice.district == district)
    if office_type:
        query = query.filter(GovernmentOffice.type == office_type)
    if q:
        like = f"%{q}%"
        query = query.filter(GovernmentOffice.name.ilike(like) | GovernmentOffice.address.ilike(like))
    offices = query.all()

    items = [_office_out(o, lat, lng) for o in offices]
    if lat is not None and lng is not None:
        items = [i for i in items if i["distance_km"] is not None and i["distance_km"] <= radius_km]
        items.sort(key=lambda i: i["distance_km"])
    return {"items": items, "total": len(items)}


@router.get("/types")
def office_types(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    types = db.query(GovernmentOffice.type).distinct().all()
    return {"types": [t[0] for t in types if t[0]]}


@router.get("/{office_id}")
def get_office(office_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    o = db.get(GovernmentOffice, office_id)
    if not o:
        raise HTTPException(status_code=404, detail="Office not found")
    return _office_out(o)
