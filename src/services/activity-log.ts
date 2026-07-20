import { createRecord } from "@/lib/repository";
import type { EntityMap } from "@/types/domain";

type ActivityLogDraft = Pick<EntityMap["activity_logs"], "site_id" | "entity_table" | "entity_id" | "action" | "description">;

export async function createActivityLogSafely(companyId: string | null | undefined, values: ActivityLogDraft, userId?: string | null) {
  if (!companyId) return true;

  try {
    await createRecord("activity_logs", companyId, values, { userId: userId || null });
    return true;
  } catch {
    return false;
  }
}
