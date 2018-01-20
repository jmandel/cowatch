# Co-watch YouTube with a friend

## Don't use this ;-)

There are [tons of better
options](https://www.google.com/search?q=youtube+webrtc+sync) if you want to
watch online videos synced with a friend. I made this one so I could understand
how they work.

## Usage

Visit `http://joshuamandel.com/cowatch/#:youtubeVideoId` and send a friend
there, too. Anybody can control the player and it mostly works.

### Example URLs

* http://joshuamandel.com/cowatch/#5ci91dfKCyc -- learn about WebRTC
* http://joshuamandel.com/cowatch/#LoT8Osx5otk -- watch an episode of Only Connect!

## Technical Details

Cloud Firestore is used for signaling and sharing ICE candidates. The Firestore
db isn't used for any other state. Open design question: how to build robust
support for >=3 parties without putting smarts into the signaling system.
