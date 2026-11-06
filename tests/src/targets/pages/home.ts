/** Logged-in home page (NAV-HOM). */
export interface HomePage {
  /** Resolves when the home page greets `firstName`. */
  expectGreeting(firstName: string): Promise<void>;
}
