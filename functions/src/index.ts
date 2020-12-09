import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'

const debug = require("@google-cloud/debug-agent").start({ allowExpresions: true })
admin.initializeApp();
const db = admin.firestore();
const fcm = admin.messaging();

debug.isReady().then(() => {
    let debugInitialized = true
    console.log("Debugger is initialize")
});

export const locationReachedNotification = functions.https.onRequest(async (request, response) => {
    const userId = request.query.uid?.toString();
    const driverId = request.query.did?.toString();
    const requestId = request.query.rid?.toString();

    if (userId === null) {
        console.log("USER NAME IS EMPTY")
        console.log("USER NAME IS EMPTY")

    } else {
        console.log(`the user is ${userId}`)
        console.log(`the user is ${userId}`)

    }

    const user = await db.collection('users').doc((userId?.toString() || '')).get()
    const token = user.data()?.token

    try {
        const payload: admin.messaging.MessagingPayload = {
            notification: {
                title: "Your ride is here",
                body: `Hey there, your ride is at the pickup location`,
                clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            },
            data: {
                userId: userId ?? '',
                id: requestId ?? '',
                driverId: driverId ?? '',
                type: 'DRIVER_AT_LOCATION'
            }
        }

        console.log("Token is" + token)
        fcm.sendToDevice([token], payload).catch(
            error => {
                response.status(500).send(error)
            }
        );
        response.send("notification sent")
    } catch (error) {
        console.log('ERROR:: ' + error)
        response.send("Notification not sent").status(500)

    }


})

export const rideAcceptedNotification = functions.firestore.document('requests/{requestId}').onUpdate(async snapshot => {
    const rideRequet = snapshot.after.data();

    if (rideRequet.status === "accepted") {
        const tokens: string[] = []

        const users = await db.collection('users').get()

        users.forEach(document => {
            const userData = document.data()
            console.log(`user id: ${userData.id}`);
            console.log(`another user id: ${rideRequet.userId}`);

            if (userData.id === rideRequet.userId) {
                tokens.push(userData.token);
            }
        })

        const payload: admin.messaging.MessagingPayload = {
            notification: {
                title: "Ride request accepted",
                body: `Hey there, your ride is on the way`,
                clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            },
            data: {
                destination: rideRequet.destination.address,
                distance_text: rideRequet.distance.text,
                distance_value: rideRequet.distance.value.toString(),
                destination_latitude: rideRequet.destination.latitude.toString(),
                destination_longitude: rideRequet.destination.longitude.toString(),
                id: rideRequet.id,
                driverId: rideRequet.driverId,
                type: 'REQUEST_ACCEPTED'

            }
        }

        console.log(`NUMBER OF TOKENS IS: ${tokens.length}`);

        return fcm.sendToDevice(tokens, payload);
    } else {
        console.log("RIDE STATUS IS: " + rideRequet.status)
        return;
    }



});

// export const rideRequestNotification = functions.firestore.document('requests/{requestId}').onCreate(
//     async snapshot => {
//         const rideRequet = snapshot.data();

//         const tokens: string[] = []

//         const drivers = await db.collection('drivers').get()

//         drivers.forEach(document => {

//             console.log(`DATA: ${document.data().token}`);

//             tokens.push(document.data().token)
//         })



//         const payload: admin.messaging.MessagingPayload = {
//             notification: {
//                 title: "Ride request",
//                 body: `${rideRequet.username} is looking for a ride to ${rideRequet.destination.address}`,
//                 clickAction: 'FLUTTER_NOTIFICATION_CLICK'
//             },
//             data: {
//                 username: rideRequet.username,
//                 destination: rideRequet.destination.address,
//                 distance_text: rideRequet.distance.text,
//                 distance_value: rideRequet.distance.value.toString(),
//                 destination_latitude: rideRequet.destination.latitude.toString(),
//                 destination_longitude: rideRequet.destination.longitude.toString(),
//                 user_latitude: rideRequet.position.latitude.toString(),
//                 user_longitude: rideRequet.position.longitude.toString(),
//                 id: rideRequet.id,
//                 userId: rideRequet.userId,
//                 type: 'RIDE_REQUEST'

//             }
//         }

//         console.log(`NUMBER OF TOKENS IS: ${tokens.length}`);

//         return fcm.sendToDevice(tokens, payload);
//     }
// )
let AMB_STATUs = {
    PENDING: "PENDING",
    ENROUTE_TO_PATIENT: "ENROUTE_TO_PATIENT",
    ENROUTE_TO_HOSPITAL: "ENROUTE_TO_HOSPITAL",
    COMPLETE: "COMPLETE",
    CANCELLED: "CANCELLED"

}

export const getAmbulanceUpdate = functions.https.onRequest(async (request, response) => {
    const rid = request.query.rid?.toString() || "";
    console.log(rid);
    const requestRef = db.collection("request").doc(rid);

    let requestData = await requestRef.get().then(async function (doc) {
        if (doc.exists) {
            console.log("Request data:", doc.data());
            return doc.data();
        } else {
            // doc.data() will be undefined in this case

            console.log("No Request fot this rid!");
            return {};
        }
    }).catch(function (error) {
        console.log("Error getting Request:", error);
        return {};
    }) || {};
    let driverData = null;
    if (requestData.driverId != "") {


        const driverRef = db.collection("drivers").doc(requestData.driverId)
        driverData = await driverRef.get().then(async function (doc) {
            if (doc.exists) {
                console.log("Driver data:", doc.data());
                return doc.data();
            } else {
                // doc.data() will be undefined in this case

                console.log("No Driver Found!");
                return {};
            }
        }).catch(function (error) {
            console.log("Error getting driver:", error);
            return {};
        }) || {};
    }

    response.send({ status: true, message: "Ambulance Request Data.", data: { request: requestData, driver: driverData } }).send(200);

})

export const requestAmbulance = functions.https.onRequest(async (request, response) => {

    // const patientId = request.query.pid?.toString();
    // const driverId = request.query.did?.toString();
    // const requestId = request.query.rid?.toString();
    let ambRequest = request.body;

    const pid = ambRequest.patient.name + "_" + ambRequest.caretaker.cnic;
    const cid = ambRequest.caretaker.cnic;
    const rid = Math.floor(Date.now() / 1000) + "_" + ambRequest.caretaker.cnic;

    const patientRef = db.collection("patient").doc(pid);
    const caretakerRef = db.collection("caretaker").doc(cid);
    const requestRef = db.collection("request").doc(rid);





    caretakerRef.get().then(async function (doc) {
        if (doc.exists) {
            console.log("Caretaker data:", doc.data());
        } else {
            // doc.data() will be undefined in this case
            await caretakerRef.set({ ...ambRequest.caretaker, id: cid })
            console.log("Caretaker Created!");
        }
    }).catch(function (error) {
        console.log("Error getting Caretaker:", error);
    });

    patientRef.get().then(async function (doc) {
        if (doc.exists) {
            console.log("Patient data:", doc.data());
        } else {
            // doc.data() will be undefined in this case
            await patientRef.set({ ...ambRequest.patient, id: pid, caretaker: caretakerRef })
            console.log("Patient Created!");
        }
    }).catch(function (error) {
        console.log("Error getting Patient:", error);
    });

    await requestRef.set({
        id: rid,
        caretaker: caretakerRef,
        patient: patientRef,
        driver: null,
        driverId: "",
        pickup: ambRequest.pickup,
        destination: ambRequest.destination,
        patient_condition: ambRequest.patient_condition,
        reason_for_transport: ambRequest.reason_for_transport,
        special_needs: ambRequest.special_needs,
        distance: ambRequest.distance,
        status: AMB_STATUs.PENDING
    });



    const drivers = await db.collection('drivers').get()

    const tokens: string[] = []

    drivers.forEach(document => {

        // console.log(`DATA: ${document.data().token}`);

        tokens.push(document.data().token)
    })



    const caretaker = { ...ambRequest.caretaker, id: cid };
    const patient = { ...ambRequest.patient, id: pid };
    const payload: admin.messaging.MessagingPayload = {
        notification: {
            title: "Ambulance request",
            body: `${ambRequest.patient_name} needs transport to ${ambRequest.destination_name}`,
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        },
        data: {
            id: rid,
            caretaker: JSON.stringify(caretaker),
            patient: JSON.stringify(patient),
            pickup: JSON.stringify(ambRequest.pickup),
            destination: JSON.stringify(ambRequest.destination),
            patient_condition: ambRequest.patient_condition,
            reason_for_transport: ambRequest.reason_for_transport,
            special_needs: JSON.stringify(ambRequest.special_needs),
            distance: ambRequest.distance,
            status: AMB_STATUs.PENDING,
            type: 'RIDE_REQUEST'

        }
    }


    let driver_cnt = tokens.length;
    console.log(`NUMBER OF TOKENS IS: ${tokens.length}`);


    await fcm.sendToDevice(tokens, payload);
    response.send({ status: true, message: "Notification Sent to  " + driver_cnt + " drivers.", data: payload.data }).send(200);
})



// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
