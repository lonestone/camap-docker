/** Public page of a group (GRP-PUB). */
export type JoinMode = 'open' | 'waiting-list' | 'closed' | 'full';

export interface GroupPublicPage {
  goto(groupId: number): Promise<void>;
  /** Group name as shown on the page. */
  name(): Promise<string>;
  /** How a visitor can join, as announced on the page. */
  joinMode(): Promise<JoinMode>;
}
