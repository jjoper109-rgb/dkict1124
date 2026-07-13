WITH search AS (
    SELECT '피스템코'::text AS keyword
)
SELECT
    c.id,
    c.name AS 업체명,
    c.business_no AS 사업자번호,
    c.address AS 주소,
    c.manager AS 담당자,
    c.phone AS 연락처,
    c.email AS 이메일,
    c.memo AS 비고,
    c.created_at AS 등록일
FROM companies c
CROSS JOIN search s
WHERE c.name ILIKE '%' || s.keyword || '%'
   OR c.business_no ILIKE '%' || s.keyword || '%'
   OR c.address ILIKE '%' || s.keyword || '%'
   OR c.manager ILIKE '%' || s.keyword || '%'
   OR c.phone ILIKE '%' || s.keyword || '%'
   OR c.email ILIKE '%' || s.keyword || '%'
ORDER BY c.name;