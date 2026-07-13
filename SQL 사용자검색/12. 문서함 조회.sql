WITH search AS (
    SELECT '피스템코'::text AS keyword
)
SELECT
    d.id,
    co.name AS 업체명,
    c.name AS 계약명,
    d.title AS 문서명,
    d.category AS 문서구분,
    d.file_name AS 파일명,
    d.file_path AS 저장경로,
    d.created_at AS 등록일
FROM documents d
LEFT JOIN companies co ON co.id = d.company_id
LEFT JOIN contracts c ON c.id = d.contract_id
CROSS JOIN search s
WHERE co.name ILIKE '%' || s.keyword || '%'
   OR c.name ILIKE '%' || s.keyword || '%'
   OR d.title ILIKE '%' || s.keyword || '%'
   OR d.file_name ILIKE '%' || s.keyword || '%'
ORDER BY d.created_at DESC;