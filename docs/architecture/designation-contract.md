# Designation contract

Designations contain `id`, `departmentId`, `title`, `isActive`, `createdAt` and `updatedAt`. Create and edit forms collect the department and title. The UUID identifies each designation, including existing records with the same title.

Migration `20261117000001_remove_designation_level.sql` removed hierarchy level. Migration `20261117000002_remove_designation_code.sql` removes the designation business code and its dependent unique index. Create/update schemas reject both removed properties. List sorting supports `title` (default) and `createdAt`, and search matches the title.

Employee creation uses an active `departmentId` and an active `designationId` belonging to that department. Onboarding reads those employee relationships to show the department and designation. Reporting hierarchy uses `managerId` and authorization uses roles and record scope.

Designation UUID fields use the shared `uuidString` validator so existing PostgreSQL UUIDs, including seeded department IDs, are accepted during creation, updates and filtering. Malformed identifiers are rejected.

Apply the new migration before starting the updated API. Existing employee and designation UUIDs remain the relationship keys. Previously applied migrations remain immutable. Development seeds omit the removed fields and use stable designation UUIDs. Restoring removed code/level values requires a pre-migration database backup. The migration has no automatic down operation.
