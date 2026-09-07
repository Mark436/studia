import type { BottomNavigationItem } from "@/components/layout/BottomNavigation";
import {
  BellIcon,
  CalendarIcon,
  ClipboardListIcon,
  UserIcon,
} from "@/components/ui/icons";

export type TabId = "schedule" | "grades" | "student" | "notifications";

export const NAV_ITEMS: ReadonlyArray<BottomNavigationItem<TabId>> = [
  { id: "schedule", label: "Horario", icon: <CalendarIcon size={22} /> },
  { id: "grades", label: "Calificaciones", icon: <ClipboardListIcon size={22} /> },
  { id: "notifications", label: "Avisos", icon: <BellIcon size={22} /> },
  { id: "student", label: "Alumno", icon: <UserIcon size={22} /> },
];

// Single home-selection point (architecture invariant): Grades is Home only
// when there are unseen grade changes to review (and the period average is
// non-zero, decided by shouldOpenGradesFirst); otherwise Schedule is.
export function getHomeTab(openGradesFirst = false): TabId {
  return openGradesFirst ? "grades" : "schedule";
}
