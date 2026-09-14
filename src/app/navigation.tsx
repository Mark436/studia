import type { BottomNavigationItem } from "@/components/layout/BottomNavigation";
import {
  CalendarIcon,
  ClipboardListIcon,
  TreeIcon,
  UserIcon,
} from "@/components/ui/icons";

export type TabId = "schedule" | "grades" | "reticula" | "student";

export const NAV_ITEMS: ReadonlyArray<BottomNavigationItem<TabId>> = [
  { id: "schedule", label: "Horario", icon: <CalendarIcon size={22} /> },
  { id: "grades", label: "Calificaciones", icon: <ClipboardListIcon size={22} /> },
  { id: "reticula", label: "Retícula", icon: <TreeIcon size={22} /> },
  { id: "student", label: "Alumno", icon: <UserIcon size={22} /> },
];

// Single home-selection point (architecture invariant): Grades is Home only
// when there are unseen grade changes to review (and the period average is
// non-zero, decided by shouldOpenGradesFirst); otherwise Schedule is.
export function getHomeTab(openGradesFirst = false): TabId {
  return openGradesFirst ? "grades" : "schedule";
}
