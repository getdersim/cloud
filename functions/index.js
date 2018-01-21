const functions = require('firebase-functions')
const admin = require('firebase-admin')
admin.initializeApp(functions.config().firebase)
const slugify = require('slugify')

const firestore = admin.firestore()

exports.register = functions.auth.user().onCreate(event => {
  const user = event.data // The Firebase user.

  const {email, displayName, photoURL, uid} = user // Details of the user.
  const isAdmin = false
  const slug = slugify(displayName, {
    replacement: '-',
    lower: true
  })
  return firestore.doc(`user/${uid}`).set({
    email,
    displayName,
    photoURL,
    uid,
    isAdmin,
    lastSignedInAt: new Date(),
    createdAt: new Date(),
    blocked: [],
    isBanned: false,
    slug
  })
})

// exports.newItem = functions.firestore.document('document/{slug}')
//   .onWrite(event => {
//     const document = event.data.data()
//     firestore.collection('kullanici').get().then(users => {
//       let tokens = []
//       users.docs.forEach(user => {
//         if (user.data().token) {
//           tokens.push(user.data().token)
//         }
//       })
//
//       const payload = {
//         notification: {
//           title: 'Yeni döküman yükledi!',
//           body: `${document.displayName} yeni bir döküman yükledi.`,
//           icon: document.photoURL
//         }
//       }
//
//       return admin.messaging().sendToDevice(tokens, payload).then(response => {
//         console.log(response)
//       })
//     })
//   })
//
