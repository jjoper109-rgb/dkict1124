WITH search AS (
    SELECT '피스템코'::text AS keyword
)
SELECT
    c.name AS 업체명,
    cc.name AS 담당자,
    cc.position AS 직책,
    cc.phone AS 연락처,
    cc.email AS 이메일,
    CASE WHEN cc.is_primary THEN '대표담당자' ELSE '' END AS 대표여부
FROM app.company_contacts cc
JOIN companies c ON c.id = cc.company_id
CROSS JOIN search s
WHERE c.name ILIKE '%' || s.keyword || '%'
   OR cc.name ILIKE '%' || s.keyword || '%'
   OR cc.phone ILIKE '%' || s.keyword || '%'
   OR cc.email ILIKE '%' || s.keyword || '%'
ORDER BY c.name, cc.is_primary DESC, cc.name;