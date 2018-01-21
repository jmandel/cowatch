function peersObservable(room, firebaseConfig) {

    var peers = new Rx.Subject();
    var db = firebase.firestore();

    //TODO make local
    peerArray = [] // {sdp, channel}

    function receiveChannelCallback(sdp, event, source) {
        //console.log("Received a channelf fir", sdp, event, source)
        peerArray
            .filter(p => p.sdp === sdp)
            .forEach(p => {
                p.channel = event.channel
            })

        peers.next(peerArray)
    }

    var peerConnectionConfig = {
        'iceServers': [
            { 'urls': ['stun:stun.l.google.com:19302'] }]
    };

    var receivedOffer;

    function send(msg) {
        peerArray
            .map(p => p.channel)
            .filter(c => c && c.readyState === 'open')
            .forEach(c => c.send(JSON.stringify(msg)))
    }

    myOfferConnection = new RTCPeerConnection(peerConnectionConfig);
    var myOfferChannel = myOfferConnection.createDataChannel("sendChannel")

    var offerPromise = myOfferConnection.createOffer();
    myOfferConnection.onicecandidate = function (event) {
        //console.log("on my ice", event.candidate)
        offerPromise.then(offer => {
            event.candidate && db.collection("iceCandidates").add({
                sdp: offer.sdp,
                ice: JSON.parse(JSON.stringify(event.candidate))
            })
        })
    };

    offerPromise.then(offer => {
        myOfferConnection.setLocalDescription(offer)
        peerArray.push({ sdp: offer.sdp, connection: myOfferConnection })
        receiveChannelCallback(offer.sdp, { channel: myOfferChannel }, "from my offer")
        //console.log("Submitting my offer", offer);

        db.collection("offers").add({
            offer: offer.sdp,
            room: room,
        })

        db.collection("offers").where("room", "==", room).onSnapshot(snapshot => {
            //console.log("new snapshopt", snapshot.docChanges.map(c => c.doc.data()));

            var answers = snapshot.docChanges
                .filter(c => c.type === "modified")
                .filter(c => c.doc.data().offer === offer.sdp)
                .filter(c => c.doc.data().answer)

            //console.log("rows about this offer", offer.sdp, answers.length, answers.map(c => [c.type, c.doc.data()]))

            if (answers.length === 1) {
                var answer = { type: 'answer', sdp: answers[0].doc.data().answer }
                //console.log("Received an answer to my offer")
                myOfferConnection.setRemoteDescription(answer).then(function () {
                    //console.log("Watching ice")
                    db.collection("iceCandidates").where("sdp", "==", answer.sdp).onSnapshot(iceSnapshot => {
                        //console.log("saw ice")
                        iceSnapshot.docChanges
                            .filter(c => c.type === 'added')
                            .forEach(c => {
                                //console.log("Saw ice candidae for remote on myOFfer")
                                myOfferConnection.addIceCandidate(new RTCIceCandidate(c.doc.data().ice));
                            })
                    })
                });
                return;
            }

            var newOffers = snapshot.docChanges
                .filter(c => c.type === "added")
                .filter(c => c.doc.data().offer !== offer.sdp);

            if (newOffers.length > 1) return;
            if (newOffers.length == 0) return;

            var theirOffer = { type: 'offer', sdp: newOffers[0].doc.data().offer };
            peerConnection = new RTCPeerConnection(peerConnectionConfig);
            peerArray.push({ sdp: theirOffer.sdp, connection: peerConnection });
            peerConnection.ondatachannel = (e => receiveChannelCallback(theirOffer.sdp, e, "from peer"))

            peerConnection.setRemoteDescription(theirOffer).then(function () {
                db.collection("iceCandidates").where("sdp", "==", theirOffer.sdp).onSnapshot(iceSnapshot => {
                    iceSnapshot.docChanges
                        .filter(c => c.type === 'added')
                        .forEach(c => {
                            //console.log("Saw ice candidae for remote peer's offer")
                            peerConnection.addIceCandidate(new RTCIceCandidate(c.doc.data().ice));
                        })
                })
            });

            var answerPromise = peerConnection.createAnswer()
            peerConnection.onicecandidate = function (event) {
                //console.log("broadcast out new ice candidate for percon")
                answerPromise.then(answer => {
                    event.candidate && db.collection("iceCandidates").add({
                        sdp: answer.sdp,
                        ice: JSON.parse(JSON.stringify(event.candidate))
                    })
                })
            };

            answerPromise.then(answer => {
                //console.log("Answering a remote conn req")
                peerConnection.setLocalDescription(answer).then(() => { })

                newOffers[0].doc.ref.update({ answer: answer.sdp })
            }).catch(e => { console.log("Create ansewr failed ", e) });

        })
    }).catch(e => { console.log("Peer connection offer creat err", e) });

    peers.send = send
    return peers
}