# Tasks and ideas

A parking lot for things that come up while working on something else.
Claude: do not read, act on or edit this file unless asked to.

## To Do

- [ ] Add a rule for the project to always use the local firebase when develoing on localhost unless I say explicitly to use the production firebase. 
- [ ] If a Americano game is created with number of rounds where all players do not play the same numner of matches, we need to use the same logic to upscale/downscale the points which we already have for when a game is finished before all players have played the same number of matches. This is to ensure that the points are fair and accurate for all players.
- [ ] When a user loses their internet connection while using the app we make a notable change to the UI to indicate that they are offline. This should be a clear and noticeable change, but it should not be disruptive to the user experience. 
- [ ] We need to ensure as soon as the user regains their internet connection, the app should automatically detect this and update the UI to reflect that they are back online. This should be done in a way that is seamless and does not interrupt the user's workflow.
- [ ] We need to sync the creator's data to Firebase if they were sharing a game. Similarly we need to sync data from Firebase to the user's link who was using a shared link. All this should happen in the background without any user intervention. 
- [ ] Do a security audit of the app. Ensure Firebae is safe and secure. No environment variables or sensitive data should be exposed in the client code. 
- [ ] Make sure no one can inject any code in the app or access the data stored in the local storage for any other user. 
- [ ] Ensure one user who is not permitted to access another user's data on Firebase cannot do so by manipulating the URL or any other means
- [ ] Enable Firebase analytics to track user behavior and app performance. This will help us understand how users are interacting with the app and identify areas for improvement.
- [ ] Do an audit of Firebase. This should include rules for proper authentication and authorization. Take a look at the code to configuration code. It should look at the data storage schema. It should take a look at all the queries and subscriptions created in the code. Ensure everything is secure. Nothing extra is being set or called or read. Minimize API calls to Firebase. Lastly all Firebase related code should be following the best practices and guidelines.

## Backlog

- [ ] Allow users to share previous game data with other users. 

## Done

