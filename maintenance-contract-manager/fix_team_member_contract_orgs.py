from pathlib import Path
import re

BASE_DIR = Path(__file__).resolve().parent
SERVER_PATH = BASE_DIR / "server.py"
APP_PATH = BASE_DIR / "app.js"

server = SERVER_PATH.read_text(encoding="utf-8")
app = APP_PATH.read_text(encoding="utf-8")

server_pattern = re.compile(
    r"def get_allowed_contract_organization_ids\(user: dict\[str, Any\]\) -> list\[str\]:\n.*?\n\ndef replace_organization_contract_links",
    re.DOTALL,
)

server_replacement = '''def contract_organization_source_id(user: dict[str, Any], cur) -> int | None:
    organization_id = parse_int(user.get("organizationId"))
    if not organization_id:
        return None
    cur.execute(
        """
        SELECT child.id, child.parent_id, parent.parent_id AS grand_parent_id
        FROM app.organizations child
        LEFT JOIN app.organizations parent
          ON parent.id = child.parent_id AND parent.is_active = TRUE
        WHERE child.id = %s AND child.is_active = TRUE
        """,
        (organization_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    if (
        user.get("role") == "team_member"
        and row.get("parent_id")
        and row.get("grand_parent_id") is not None
    ):
        return int(row["parent_id"])
    return organization_id


def get_allowed_contract_organization_ids(user: dict[str, Any]) -> list[str]:
    role = user.get("role")
    with db() as conn:
        with conn.cursor() as cur:
            if role in FULL_ACCESS_ROLES:
                cur.execute(
                    """
                    SELECT id
                    FROM app.organizations
                    WHERE is_active = TRUE AND parent_id IS NOT NULL
                    ORDER BY sort_order, id
                    """
                )
                return [str(row["id"]) for row in cur.fetchall()]

            source_id = contract_organization_source_id(user, cur)
            if not source_id:
                return []
            cur.execute(
                """
                SELECT 1
                FROM app.organizations
                WHERE id = %s AND is_active = TRUE AND parent_id IS NOT NULL
                """,
                (source_id,),
            )
            if not cur.fetchone():
                return []
            cur.execute(
                """
                SELECT l.organization_a_id, l.organization_b_id
                FROM app.organization_contract_links l
                JOIN app.organizations a ON a.id = l.organization_a_id AND a.is_active = TRUE
                JOIN app.organizations b ON b.id = l.organization_b_id AND b.is_active = TRUE
                WHERE l.is_active = TRUE
                  AND a.parent_id IS NOT NULL
                  AND b.parent_id IS NOT NULL
                  AND %s IN (l.organization_a_id, l.organization_b_id)
                """,
                (source_id,),
            )
            resolved_ids = resolve_allowed_organization_ids(source_id, cur.fetchall())
            ordered_ids = [source_id, *sorted(value for value in resolved_ids if value != source_id)]
            return [str(value) for value in ordered_ids]


def replace_organization_contract_links'''

server, count = server_pattern.subn(server_replacement, server, count=1)
if count != 1:
    raise RuntimeError("server organization permission block was not found")

old_app = '''function defaultContractOrganizationId() {
  if (state.user?.role === "team_member") {
    return parentContractOrganizationIdForCurrentUser();
  }
  if (hasFullAccess()) {
    return state.data.organizations.find((org) => org.parentId)?.id || "";
  }
  return state.user?.organizationId || "";
}'''

new_app = '''function defaultContractOrganizationId() {
  if (hasFullAccess()) {
    return state.data.organizations.find((org) => org.parentId)?.id || "";
  }
  const allowedIds = (state.allowedContractOrganizationIds || []).map(String);
  const userOrganizationId = String(state.user?.organizationId || "");
  if (allowedIds.includes(userOrganizationId)) return userOrganizationId;
  const parentId = String(organizationById(userOrganizationId)?.parentId || "");
  if (parentId && allowedIds.includes(parentId)) return parentId;
  return allowedIds[0] || userOrganizationId;
}'''

if old_app not in app:
    raise RuntimeError("app default contract organization block was not found")
app = app.replace(old_app, new_app, 1)

SERVER_PATH.write_text(server, encoding="utf-8")
APP_PATH.write_text(app, encoding="utf-8")
