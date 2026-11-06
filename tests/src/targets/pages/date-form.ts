/** A form page with date, time and date-time fields (NAV-THM-005). */
export type DateFieldKind = 'day' | 'startTime' | 'ordersOpening';

export interface DateFormPage {
  /**
   * Open the form to create a distribution day, as a group admin who has chosen the group.
   * With `emptyDates` the page is served with no value in its date fields.
   */
  goto(opts?: { emptyDates?: boolean }): Promise<void>;
  /** The text the field shows to the user. */
  shown(field: DateFieldKind): Promise<string>;
  /** The value the field will post on submit (`YYYY-MM-DD HH:MM:SS`, local time of the browser). */
  submitted(field: DateFieldKind): Promise<string>;
  /** The value the server gave the field in the page (`YYYY-MM-DD HH:MM:SS`), null when none. */
  served(field: DateFieldKind): Promise<string | null>;
  /** Type a date (as the field shows it, e.g. `lundi 7 décembre 2027`) and leave the field. */
  type(field: DateFieldKind, text: string): Promise<void>;
  /** Touch the field and resolve with whether a picker (a calendar or a clock) opens. */
  opensPicker(field: DateFieldKind): Promise<boolean>;
}
