# Tasks and ideas

A parking lot for things that come up while working on something else.
Claude: do not read, act on or edit this file unless asked to.

## In Progress

- [ ] Do not allow to broadcast finished games. 

## To Do

- [ ] When I delete a game, which is being broadcasted with other users. The firebsase connection should be closed. Live badge should be removed. As for the game just mark it as finished for the users. Keep the data and scores on their device. On the creators phone we simply delete everything. Also delete everything from firebase once the data has been synced to the users device. In this case use the score upscaling logic to ensure that the scores are fair and accurate for all players on the viewers device.
- [ ] When typing a name the keyboard has a huge empty space on top of it so the visible screen is too small. Check the red area highlighted in the screenshot. This is on iOS I have not tested on android. But both platforms need to have minimum space required to separate the keyboard from the visible screen. This is a UX issue and needs to be fixed.
- [ ] Create a short link for the shared/broadcast link for users to share. 
- [ ] Can we also change the og description and title for the shared link so that user knows which game its for? If not, then leave it. This is not a priority. 
- [ ] When a user loses their internet connection while using the app we make a notable change to the UI to indicate that they are offline. This should be a clear and noticeable change, but it should not be disruptive to the user experience. **(This this feature before coding I think it is already working like this)**
- [ ] We need to ensure as soon as the user regains their internet connection, the app should automatically detect this and update the UI to reflect that they are back online. This should be done in a way that is seamless and does not interrupt the user's workflow. **(This this feature before coding I think it is already working like this)**
- [ ] We need to sync the creator's data to Firebase if they were sharing a game. Similarly we need to sync data from Firebase to the user's link who was using a shared link. All this should happen in the background without any user intervention. **(This this feature before coding I think it is already working like this)** 

## Backlog

- [ ] Do an audit of Firebase. This should include rules for proper authentication and authorization. Take a look at the code to configuration code. It should look at the data storage schema. It should take a look at all the queries and subscriptions created in the code. Ensure everything is secure. Nothing extra is being set or called or read. Minimize API calls to Firebase. Lastly all Firebase related code should be following the best practices and guidelines.
- [ ] Do a security audit of the app. Ensure Firebae is safe and secure. No environment variables or sensitive data should be exposed in the client code. 
- [ ] Make sure no one can inject any code in the app or access the data stored in the local storage for any other user. 
- [ ] Ensure one user who is not permitted to access another user's data on Firebase cannot do so by manipulating the URL or any other means
- [ ] Enable Firebase analytics to track user behavior and app performance. This will help us understand how users are interacting with the app and identify areas for improvement.
- [ ] Allow users to share previous game data with other users. 
- [ ] Delete any data older than 6 months from Firebase. Including match, games and anonymouse user data. Delete any data which I have not explicitly listed here. 
- [ ] Check all the code for missing unit tests. Add unit tests for any missing code. Ensure that all the code is covered by unit tests. 

## Done

- [x] I shared a link for a game with a friend. It opened the game directly on the rounds screen. It had the "live" badge but when he pressed the back button to navigate to the "home" page. It showed the current game in the history. The game card has the "shared" text but it did not have the "live" badge on the home screen.
- [x] What happens in this case. When a game is being broadcasted but then it is left for a new game which is also broadcasted. When are we going to cancel the firebase subscription and live status of the unfinished game?
- [x] Let's make it so there is only 1 game being broadcasted from a device at any time. When a user broadcast a new game we tell them that the current broadcast will be closed. But what happens when I want to create a broadcast link for a game which was previously broadcasted? Will the same link be accessible? It should be. Do not create a new link for the same game.
- [x] Test when a game is finished are the Firebase connections for both the viewers and creator of the game are closed. If not, then we need to close them. This should also hide the "live" badge on the home screen for the shared game.
- [x] If a Americano game is created with number of rounds where all players do not play the same numner of matches, we need to use the same logic to upscale/downscale the points which we already have for when a game is finished before all players have played the same number of matches. This is to ensure that the points are fair and accurate for all players.
- [x] Should we implement a max time for a connection. In case there are rouge subscriptions which are not closed properly. This is to ensure that the firebase connections are not left open for a long time.
  - [x] One rule: a friend's game is followed for 4 hours from when it was created, on the home screen and the game screen
  - [x] Game screen: close the connection when the game turns 4 hours old; opened later, read the score once
