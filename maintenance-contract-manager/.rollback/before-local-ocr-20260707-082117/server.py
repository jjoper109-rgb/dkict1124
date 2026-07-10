import os
import re
import shutil
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Any

import psycopg
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from psycopg.rows import dict_row


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / "config.env"
DEFAULT_UPLOAD_DIR = r"\\125.136.150.4\ict\유지보수계약"


def load_env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    if ENV_PATH.exists():
        for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"')
    return values


CONFIG = {
    "DB_HOST": "localhost",
    "DB_PORT": "5432",
    "DB_NAME": "maintenance_db",
    "DB_USER": "maintenance_user",
    "DB_PASSWORD": "Maintenance@2026!",
    "UPLOAD_DIR": DEFAULT_UPLOAD_DIR,
    **load_env_file(),
}


def conninfo() -> str:
    return (
        f"host={CONFIG['DB_HOST']} "
        f"port={CONFIG['DB_PORT']} "
        f"dbname={CONFIG['DB_NAME']} "
        f"user={CONFIG['DB_USER']} "
        f"password={CONFIG['DB_PASSWORD']}"
    )


def db() -> psycopg.Connection:
    return psycopg.connect(conninfo(), row_factory=dict_row)


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def clean_filename(name: str) -> str:
    stem = Path(name).stem or "file"
    suffix = Path(name).suffix
    stem = re.sub(r'[\\/:*?"<>|]+', "_", stem).strip()
    return f"{stem[:80]}{suffix[:20]}"


def row_to_client(row: dict[str, Any]) -> dict[str, Any]:
    converted: dict[str, Any] = {}
    aliases = {
        "business_no": "businessNo",
        "company_id": "companyId",
        "start_date": "startDate",
        "end_date": "endDate",
        "billing_cycle": "billingCycle",
        "renewal_date": "renewalDate",
        "alert_days": "alertDays",
        "auto_alert": "autoAlert",
        "work_date": "date",
        "file_name": "fileName",
        "file_path": "filePath",
        "created_at": "createdAt",
    }
    for key, value in row.items():
        client_key = aliases.get(key, key)
        if key == "id" or key.endswith("_id"):
            converted[client_key] = "" if value is None else str(value)
        elif isinstance(value, (datetime, date)):
            converted[client_key] = value.isoformat()
        else:
            converted[client_key] = value
    return converted


def fetch_all(table: str, order_by: str = "id") -> list[dict[str, Any]]:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM {table} ORDER BY {order_by}")
            return [row_to_client(row) for row in cur.fetchall()]


def fetch_one(table: str, item_id: int) -> dict[str, Any]:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT * FROM {table} WHERE id = %s", (item_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="not found")
            return row_to_client(row)


def insert_row(table: str, values: dict[str, Any]) -> dict[str, Any]:
    columns = list(values.keys())
    placeholders = ", ".join(["%s"] * len(columns))
    sql = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders}) RETURNING *"
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, tuple(values.values()))
            return row_to_client(cur.fetchone())


def update_row(table: str, item_id: int, values: dict[str, Any]) -> dict[str, Any]:
    if not values:
        return fetch_one(table, item_id)
    assignments = ", ".join([f"{column} = %s" for column in values])
    sql = f"UPDATE {table} SET {assignments} WHERE id = %s RETURNING *"
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (*values.values(), item_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="not found")
            return row_to_client(row)


def delete_row(table: str, item_id: int) -> dict[str, bool]:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {table} WHERE id = %s", (item_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="not found")
            return {"ok": True}


def parse_int(value: Any, default: int = 0) -> int:
    try:
        return int(value or default)
    except ValueError:
        return default


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "on", "y"}


app = FastAPI(title="Maintenance Contract Manager")


@app.get("/api/health")
def health() -> dict[str, Any]:
    upload_dir = Path(CONFIG["UPLOAD_DIR"])
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            db_ok = cur.fetchone()["ok"] == 1
    return {
        "ok": True,
        "db": db_ok,
        "uploadDir": str(upload_dir),
        "uploadDirExists": upload_dir.exists(),
        "time": now_iso(),
    }


@app.get("/api/bootstrap")
def bootstrap() -> dict[str, Any]:
    return {
        "companies": fetch_all("companies"),
        "contracts": fetch_all("contracts"),
        "assets": fetch_all("maintenance_assets"),
        "worklogs": fetch_all("work_logs", "work_date DESC, id DESC"),
        "documents": fetch_all("documents", "created_at DESC, id DESC"),
        "config": {"defaultAlertDays": 60, "uploadDir": CONFIG["UPLOAD_DIR"]},
    }


@app.post("/api/companies")
def create_company(payload: dict[str, Any]) -> dict[str, Any]:
    return insert_row("companies", {
        "name": payload.get("name"),
        "business_no": payload.get("businessNo"),
        "address": payload.get("address"),
        "manager": payload.get("manager"),
        "phone": payload.get("phone"),
        "email": payload.get("email"),
        "memo": payload.get("memo"),
    })


@app.put("/api/companies/{item_id}")
def update_company(item_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return update_row("companies", item_id, {
        "name": payload.get("name"),
        "business_no": payload.get("businessNo"),
        "address": payload.get("address"),
        "manager": payload.get("manager"),
        "phone": payload.get("phone"),
        "email": payload.get("email"),
        "memo": payload.get("memo"),
    })


@app.delete("/api/companies/{item_id}")
def delete_company(item_id: int) -> dict[str, bool]:
    return delete_row("companies", item_id)


@app.post("/api/contracts")
def create_contract(payload: dict[str, Any]) -> dict[str, Any]:
    return insert_row("contracts", contract_values(payload))


@app.put("/api/contracts/{item_id}")
def update_contract(item_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return update_row("contracts", item_id, contract_values(payload))


@app.delete("/api/contracts/{item_id}")
def delete_contract(item_id: int) -> dict[str, bool]:
    return delete_row("contracts", item_id)


def contract_values(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "company_id": parse_int(payload.get("companyId")),
        "name": payload.get("name"),
        "start_date": payload.get("startDate"),
        "end_date": payload.get("endDate"),
        "amount": parse_int(payload.get("amount")),
        "billing_cycle": payload.get("billingCycle") or "yearly",
        "status": payload.get("status") or "active",
        "renewal_date": payload.get("renewalDate") or None,
        "alert_days": parse_int(payload.get("alertDays"), 60) or 60,
        "auto_alert": parse_bool(payload.get("autoAlert", True)),
        "memo": payload.get("memo"),
    }


@app.post("/api/assets")
def create_asset(payload: dict[str, Any]) -> dict[str, Any]:
    return insert_row("maintenance_assets", asset_values(payload))


@app.put("/api/assets/{item_id}")
def update_asset(item_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return update_row("maintenance_assets", item_id, asset_values(payload))


@app.delete("/api/assets/{item_id}")
def delete_asset(item_id: int) -> dict[str, bool]:
    return delete_row("maintenance_assets", item_id)


def asset_values(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "company_id": parse_int(payload.get("companyId")),
        "type": payload.get("type") or "equipment",
        "name": payload.get("name"),
        "serial": payload.get("serial"),
        "location": payload.get("location"),
        "memo": payload.get("memo"),
    }


@app.post("/api/worklogs")
def create_worklog(payload: dict[str, Any]) -> dict[str, Any]:
    return insert_row("work_logs", worklog_values(payload))


@app.put("/api/worklogs/{item_id}")
def update_worklog(item_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    return update_row("work_logs", item_id, worklog_values(payload))


@app.delete("/api/worklogs/{item_id}")
def delete_worklog(item_id: int) -> dict[str, bool]:
    return delete_row("work_logs", item_id)


def worklog_values(payload: dict[str, Any]) -> dict[str, Any]:
    contract_id = parse_int(payload.get("contractId"))
    return {
        "company_id": parse_int(payload.get("companyId")),
        "contract_id": contract_id or None,
        "work_date": payload.get("date"),
        "category": payload.get("category") or "visit",
        "status": payload.get("status") or "done",
        "worker": payload.get("worker"),
        "title": payload.get("title"),
        "content": payload.get("content"),
    }


@app.post("/api/documents")
async def create_document(
    companyId: int = Form(...),
    contractId: int | None = Form(None),
    category: str = Form("contract"),
    title: str = Form(...),
    memo: str = Form(""),
    file: UploadFile | None = File(None),
) -> dict[str, Any]:
    return await save_document(None, companyId, contractId, category, title, memo, file)


@app.put("/api/documents/{item_id}")
async def update_document(
    item_id: int,
    companyId: int = Form(...),
    contractId: int | None = Form(None),
    category: str = Form("contract"),
    title: str = Form(...),
    memo: str = Form(""),
    file: UploadFile | None = File(None),
) -> dict[str, Any]:
    return await save_document(item_id, companyId, contractId, category, title, memo, file)


async def save_document(
    item_id: int | None,
    company_id: int,
    contract_id: int | None,
    category: str,
    title: str,
    memo: str,
    file: UploadFile | None,
) -> dict[str, Any]:
    values = {
        "company_id": company_id,
        "contract_id": contract_id or None,
        "category": category,
        "title": title,
        "memo": memo,
    }
    if file and file.filename:
        upload_root = Path(CONFIG["UPLOAD_DIR"])
        upload_root.mkdir(parents=True, exist_ok=True)
        month_dir = upload_root / datetime.now().strftime("%Y-%m")
        month_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}_{clean_filename(file.filename)}"
        destination = month_dir / stored_name
        with destination.open("wb") as output:
            shutil.copyfileobj(file.file, output)
        values["file_name"] = file.filename
        values["file_path"] = str(destination)
    if item_id:
        return update_row("documents", item_id, values)
    return insert_row("documents", values)


@app.delete("/api/documents/{item_id}")
def delete_document(item_id: int) -> dict[str, bool]:
    document = fetch_one("documents", item_id)
    result = delete_row("documents", item_id)
    file_path = document.get("filePath")
    if file_path:
        try:
            Path(file_path).unlink(missing_ok=True)
        except OSError:
            pass
    return result


@app.get("/api/documents/{item_id}/download")
def download_document(item_id: int) -> FileResponse:
    document = fetch_one("documents", item_id)
    file_path = document.get("filePath")
    if not file_path or not Path(file_path).exists():
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(file_path, filename=document.get("fileName") or Path(file_path).name)


app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")
