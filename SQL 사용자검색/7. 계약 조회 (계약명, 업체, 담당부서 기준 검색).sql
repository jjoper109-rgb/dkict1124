WITH search AS (
    SELECT '유지'::text AS keyword
)
SELECT
    c.id,
    co.name AS 업체명,
    c.name AS 계약명,
    o.name AS 담당부서,
    c.start_date AS 시작일,
    c.end_date AS 종료일,
    c.amount AS 계약금액,
    c.billing_cycle AS 지급방식,
    c.status AS 상태,
    c.renewal_date AS 갱신예정일,
    c.alert_days AS 알림일수,
    c.memo AS 비고
FROM contracts c
LEFT JOIN companies co ON co.id = c.company_id
LEFT JOIN app.contract_organizations corg ON corg.contract_id = c.id
LEFT JOIN app.organizations o ON o.id = corg.organization_id
CROSS JOIN search s
WHERE c.name ILIKE '%' || s.keyword || '%'
   OR co.name ILIKE '%' || s.keyword || '%'
   OR o.name ILIKE '%' || s.keyword || '%'
ORDER BY c.end_date;