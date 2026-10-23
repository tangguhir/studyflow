ALTER TABLE "Subtask"
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "taskId" ORDER BY "createdAt" ASC, "id" ASC) - 1 AS "position"
  FROM "Subtask"
)
UPDATE "Subtask" AS subtask
SET "position" = ordered."position"
FROM ordered
WHERE subtask."id" = ordered."id";

CREATE INDEX "Subtask_taskId_position_idx" ON "Subtask"("taskId", "position");
