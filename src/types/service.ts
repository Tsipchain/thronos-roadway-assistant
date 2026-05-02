import { ServiceType } from "@prisma/client";

export const serviceTypeLabels: Record<ServiceType, string> = {
  BATTERY_REPLACEMENT: "Αλλαγή μπαταρίας",
  BATTERY_CHARGE: "Φόρτιση μπαταρίας",
  TIRE_CHANGE: "Αλλαγή ελαστικού",
  TIRE_REPAIR: "Επισκευή ελαστικού",
  DIAGNOSIS: "Διάγνωση",
};
