/** Behaviour of the shared page layout in a browser (NAV-THM). */
export interface LayoutPage {
  /** Open the group chooser as a logged-in user and wait until the page scripts have run. */
  openGroupChooser(): Promise<void>;
  /** Click the first visible button of the page without following its link; resolves with what the click did to the button. */
  pressFirstButton(): Promise<{ disabledRightAfter: boolean; clickableRightAfter: boolean }>;
  /** Resolves with whether the button pressed last is clickable again. */
  pressedButtonClickableAgain(): Promise<boolean>;
}
