# Tasks and ideas

A parking lot for things that come up while working on something else.
Claude: do not read, act on or edit this file unless asked to.

## In Progress

- [ ] From the 15-player Americano test: the same game was open in two tabs of the same browser, and the organiser could edit it in one of them. Each tab kept its own copy and saved the whole game, so a score entered in a tab that was behind wiped the scores entered in the other.
  - [x] Every save and delete is told to the other tabs, and they reload the game (`onChangedElsewhere` in `src/lib/storage.ts`, used by `openGame` in `src/lib/live.ts`)
  - [x] Tested in two tabs at phone size: a score in each shows in the other, both are stored, and a delete in one shows "no longer on this phone" in the other
  - [x] Review the change and commit it (`4427770` on `dev`)
  - [x] A tab also reloads the game when it comes back to the front, in case it missed a change while in the background
  - [x] Decide: is syncing the tabs enough, or should the second tab be locked? Syncing is enough. A lock needs the same tab-to-tab messages, and the organiser would have to work out which tab is the locked one
  - [x] The Live badge follows across tabs: a broadcast started or closed in one tab shows in the other, on the game and on the home screen
  - [x] The home list in the other tab shows a game made, changed or deleted in this one
  - [x] An iPhone older than iOS 15.4 (no `BroadcastChannel`) loads the app; its tabs just don't sync. Not tried on such a phone

## To Do

- [ ] Show the +/- point difference in the match result card which is shared. Show it everywhere where we have space for it.
- [ ] Add a banner on the home page to view latest features. It navigates to a page with its own URL which shows which features are pushed. When. What they do and how they work. 
- [ ] When I want to change the rounds manually the app shows the alternate number of rounds only once. E.g. for 4 players the app suggest 3 rounds. When I change it to 4 the shows a warning that all players will not play equal matches. This is fine, but when I change the rounds to 6 the app still suggests to change it to 3 rounds instead of approving the choice because all players still play equal matches. This should also be accomodated in the initial suggestion the app gives when the user manually changes the number of rounds.  
- [ ] From the 15-player Americano test: the app in the browser and the app on the home screen have different storage. This is iOS, not a bug: an iPhone gives a home-screen app its own storage apart from Safari, and code cannot join them. A game made in one is not in the other. Links always open in Safari, so an organiser running the game in the home-screen app who taps their own link gets a read-only "Shared" copy. Pick one:
  - [ ] A (recommended): a box on the home screen of the installed app to paste a link, so a friend can follow a broadcast there. Small, but it does not move the organiser's own game
  - [ ] B: move a game across, by exporting it from one and importing it into the other. The real fix for the organiser, but a new feature
  - [ ] C: just say so, with one line on the install prompt that games do not carry over
- [ ] From the 15-player Americano test: when everything ended some games were still live, and it is confusing which game you entered and which is actually live. A broadcast only stops being Live when the organiser taps Finish, broadcasts another game from the same storage, or the game turns 4 hours old. Entering the last score does not close it. Safari and the home-screen app each allow their own live game, so one phone can have two. Pick one:
  - [ ] A (recommended): Live means recent. Show Live only if a score arrived in the last 20 minutes or so, otherwise "Paused". Needs a timestamp on the online copy, not on the stored game
  - [ ] B: a Stop broadcast button in the game's menu. Only helps if the organiser remembers to tap it
  - [ ] C: both
  - [ ] Answer first: were you the organiser with several games of your own, or a friend who had opened several links? That decides whether the home list also needs a clearer mark for which game is yours


## Backlog

- [ ] Check on a real phone: turn it sideways and back (iPhone Safari, Android Chrome); type a player's name on Android and see no "turn upright" appear; score a 32-point game in the installed iPhone app and see Save score clear of the home bar
- [ ] Do an audit of Firebase. This should include rules for proper authentication and authorization. Take a look at the code to configuration code. It should look at the data storage schema. It should take a look at all the queries and subscriptions created in the code. Ensure everything is secure. Nothing extra is being set or called or read. Minimize API calls to Firebase. Lastly all Firebase related code should be following the best practices and guidelines.
- [ ] Do a security audit of the app. Ensure Firebae is safe and secure. No environment variables or sensitive data should be exposed in the client code. 
- [ ] Make sure no one can inject any code in the app or access the data stored in the local storage for any other user. 
- [ ] Ensure one user who is not permitted to access another user's data on Firebase cannot do so by manipulating the URL or any other means
- [ ] Enable Firebase analytics to track user behavior and app performance. This will help us understand how users are interacting with the app and identify areas for improvement.
- [ ] Allow users to share previous game data with other users. 
- [ ] Delete any data older than 6 months from Firebase. Including match, games and anonymouse user data. Delete any data which I have not explicitly listed here. 
- [ ] Check all the code for missing unit tests. Add unit tests for any missing code. Ensure that all the code is covered by unit tests. 
- [ ] Review all the repo for dead code. If you find any comment it, run the tests and ensure that the code is not being used anywhere. If it is not being used anywhere, delete it.
- [ ] Can we also change the og description and title for the shared link so that user knows which game its for? If not, then leave it. This is not a priority. If this is not possible ignore it and move it to backlog.
  - Needs a server: a Cloudflare Pages function on /t/* and /m/* that reads the game and fills in the tags. Not possible on a purely static site.
- [ ] Separate data stored in Firestore for production and development. 
- [ ] When typing a name the keyboard has a huge empty space on top of it so the visible screen is too small. Check the red area highlighted in the screenshot. This is on iOS I have not tested on android. But both platforms need to have minimum space required to separate the keyboard from the visible screen. This is a UX issue and needs to be fixed.
  - [x] The app follows the visible part of the screen instead of scrolling the page back to the top
  - [x] Check on a real iPhone, in Chrome and in Safari: tap the player field on New game and see no white gap above the keyboard, and Create still in view
  - [ ] Check on an Android phone: same field, no gap

## Done

- [x] Test the web app on all different screen sizes and resolutions to ensure that it is responsive and works well on all devices. This includes testing on desktop, tablet, and mobile devices, as well as different browsers. Store screenshots for yourself, compare them and fix any inconsistencies or issues that arise. This is important to ensure that the app provides a consistent and high-quality user experience across all platforms.
  - [x] A phone turned on its side shows "turn your phone upright" instead of a squeezed app
  - [x] Save score stays in view on the score sheet while the numbers scroll
  - [x] Standings open at the top of the table
  - [x] Small buttons get a 44px tap area
  - [x] Run the same sweep in Safari's and Firefox's engines
- [x] I shared a link for a game with a friend. It opened the game directly on the rounds screen. It had the "live" badge but when he pressed the back button to navigate to the "home" page. It showed the current game in the history. The game card has the "shared" text but it did not have the "live" badge on the home screen.
- [x] What happens in this case. When a game is being broadcasted but then it is left for a new game which is also broadcasted. When are we going to cancel the firebase subscription and live status of the unfinished game?
- [x] Let's make it so there is only 1 game being broadcasted from a device at any time. When a user broadcast a new game we tell them that the current broadcast will be closed. But what happens when I want to create a broadcast link for a game which was previously broadcasted? Will the same link be accessible? It should be. Do not create a new link for the same game.
- [x] Test when a game is finished are the Firebase connections for both the viewers and creator of the game are closed. If not, then we need to close them. This should also hide the "live" badge on the home screen for the shared game.
- [x] If a Americano game is created with number of rounds where all players do not play the same numner of matches, we need to use the same logic to upscale/downscale the points which we already have for when a game is finished before all players have played the same number of matches. This is to ensure that the points are fair and accurate for all players.
- [x] Should we implement a max time for a connection. In case there are rouge subscriptions which are not closed properly. This is to ensure that the firebase connections are not left open for a long time.
  - [x] One rule: a friend's game is followed for 4 hours from when it was created, on the home screen and the game screen
  - [x] Game screen: close the connection when the game turns 4 hours old; opened later, read the score once
- [x] Do not allow to broadcast finished games. 
  - [x] No broadcast item in the menu of a finished game
  - [x] Finishing a game whose broadcast was closed sends its final result once
  - [x] Opening a finished game sends a final result that never went out
- [x] When I delete a game, which is being broadcasted with other users. The firebsase connection should be closed. Live badge should be removed. As for the game just mark it as finished for the users. Keep the data and scores on their device. On the creators phone we simply delete everything. Also delete everything from firebase once the data has been synced to the users device. In this case use the score upscaling logic to ensure that the scores are fair and accurate for all players on the viewers device.
  - [x] A friend's copy becomes a finished game when the organiser deletes theirs (Americano points scaled for fewer games)
  - [x] A finished match with no winner shows the team ahead, or "Level", on its result card
  - [x] A delete made with no connection is retried when the app starts
- [x] Create a short link for the shared/broadcast link for users to share. 
- [x] When a user loses their internet connection while using the app we make a notable change to the UI to indicate that they are offline. This should be a clear and noticeable change, but it should not be disruptive to the user experience. **(This this feature before coding I think it is already working like this)**
  - [x] The Live badge turns to a grey Offline with no connection, and back by itself
  - [x] Broadcast live with no connection says so at once; on a dead connection the spinner closes after 5 seconds
- [x] We need to ensure as soon as the user regains their internet connection, the app should automatically detect this and update the UI to reflect that they are back online. This should be done in a way that is seamless and does not interrupt the user's workflow. **(This this feature before coding I think it is already working like this)**
  - [x] Tested, no code needed: the badge goes back to Live and the score catches up about a second after the connection returns, with no reload
- [x] We need to sync the creator's data to Firebase if they were sharing a game. Similarly we need to sync data from Firebase to the user's link who was using a shared link. All this should happen in the background without any user intervention. **(This this feature before coding I think it is already working like this)** 
  - [x] Tested, no code needed: with the app left open, both sides catch up by themselves when the connection returns
  - [x] Scores entered with no connection are sent again when the app starts, in case it was closed before they went
- [x] Should we use "/private/tmp/claude-501/-Users-hzburki-Code-side-projects-padel/26c143f9-5657-4262-b872-1f5b9a09ef7b/scratchpad/sweep/sweep.mjs" and use it for snapshot? We can create a command for it. Store all the images in the repo. Push them to git. When we run it matches the exisitng pages with existing images. If they do not match it throws an error and the LLM can take over. If images don't exist the LLM can be sent the new screenshots to review once, fix errors and store them in the repo? 
  - [x] `npm run shots` walks every screen at phone, tablet and desktop size and compares each with a stored image
  - [x] The seeded games are the same on every run (fixed date, fixed pairings)
  - [x] The stored images are in the repo, and a changed screen fails the run with a diff image
  - [x] `/shots` runs it and has Claude look at each mismatch
