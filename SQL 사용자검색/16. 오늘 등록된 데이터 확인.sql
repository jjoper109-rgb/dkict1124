SELECT '업체' AS 구분, id::text, name AS 이름, created_at AS 등록일
FROM companies
WHERE created_at::date = CURRENT_DATE

UNION ALL

SELECT '계약' AS 구분, id::text, name AS 이름, created_at AS 등록일
FROM contracts
WHERE created_at::date = CURRENT_DATE

UNION ALL

SELECT '문서' AS 구분, id::text, title AS 이름, created_at AS 등록일
FROM documents
WHERE created_at::date = CURRENT_DATE

ORDER BY 등록일 DESC;