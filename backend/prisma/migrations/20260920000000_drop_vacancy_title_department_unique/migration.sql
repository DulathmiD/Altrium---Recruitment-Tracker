-- R-10 in the risk register: this unique index blocked creating a new
-- vacancy with the same title+department as any existing one, including an
-- already-CLOSED one -- a legitimate business action (reposting a role
-- later) was being rejected as if it were a duplicate. MySQL has no partial/
-- filtered unique index, so the "only unique among active vacancies" rule
-- is now enforced in application code instead (vacancy.controller.ts).
DROP INDEX `Vacancy_title_department_key` ON `Vacancy`;
