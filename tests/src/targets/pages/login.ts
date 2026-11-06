/** Login form (ACC-LOG). */
export interface LoginPage {
  goto(): Promise<void>;
  /** Fill and submit the form; does not wait for the outcome. */
  submit(email: string, password: string): Promise<void>;
  /** Resolves when the "wrong credentials" error is visible. */
  expectWrongCredentials(): Promise<void>;
}
