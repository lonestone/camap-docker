/** The attendance sheet of a constant-orders catalog, as drawn in the browser (DIS-ATT-009). */
export type AttendanceOption = 'contact' | 'product' | 'date';

export interface AttendanceSheetPage {
  /** Open the sheet of a catalog distribution and wait until its display options are shown. */
  goto(distributionId: number): Promise<void>;
  reload(): Promise<void>;
  /** Choose one of the choices (0, 1, 2) of a display option. */
  choose(option: AttendanceOption, choice: number): Promise<void>;
  /** The choice currently selected for an option. */
  chosen(option: AttendanceOption): Promise<number>;
}
