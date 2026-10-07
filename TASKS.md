# Tasks and ideas

A parking lot for things that come up while working on something else.
Claude: do not read, act on or edit this file unless asked to.

## To Do

- [ ] When a user loses their internet connection while using the app we make a notable change to the UI to indicate that they are offline. This should be a clear and noticeable change, but it should not be disruptive to the user experience. 
- [ ] We need to ensure as soon as the user regains their internet connection, the app should automatically detect this and update the UI to reflect that they are back online. This should be done in a way that is seamless and does not interrupt the user's workflow.
- [ ] We need to sync the creator's data to Firebase if they were sharing a game. Similarly we need to sync data from Firebase to the user's link who was using a shared link. All this should happen in the background without any user intervention. 
- [ ] Do a security audit of the app. Ensure Firebae is safe and secure. No environment variables or sensitive data should be exposed in the client code. 
- [ ] Make sure no one can inject any code in the app or access the data stored in the local storage for any other user. 
- [ ] Ensure one user who is not permitted to access another user's data on Firebase cannot do so by manipulating the URL or any other means

## Backlog

- [ ] Allow users to share previous game data with other users. 

## Done

