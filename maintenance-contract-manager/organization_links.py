from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any


def normalize_organization_pair(first_id: Any, second_id: Any) -> tuple[int, int]:
    """Return a stable, non-self-referencing organization pair."""
    first = int(first_id)
    second = int(second_id)
    if first == second:
        raise ValueError("organization link must contain two different organizations")
    return (first, second) if first < second else (second, first)


def resolve_allowed_organization_ids(
    source_organization_id: Any,
    links: Iterable[Mapping[str, Any]],
) -> list[int]:
    """Resolve the source organization and every bidirectionally linked organization."""
    source_id = int(source_organization_id)
    allowed_ids = {source_id}
    for link in links:
        first = int(link.get("organization_a_id") or link.get("organizationAId") or 0)
        second = int(link.get("organization_b_id") or link.get("organizationBId") or 0)
        if first == source_id and second:
            allowed_ids.add(second)
        elif second == source_id and first:
            allowed_ids.add(first)
    return sorted(allowed_ids)
