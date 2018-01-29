const functions = require('firebase-functions')
const admin = require('firebase-admin')
admin.initializeApp(functions.config().firebase)
const slugify = require('slugify')
const firestore = admin.firestore()
const algoliasearch = require('algoliasearch')

const client = algoliasearch(functions.config().algolia.app_id, functions.config().algolia.api_key)

// Name fo the algolia index for Blog posts content.
const ALGOLIA_INDEX_NAME = 'documents'

exports.register = functions.auth.user().onCreate(event => {
  const user = event.data // The Firebase user.

  const {email, displayName, photoURL, uid} = user // Details of the user.
  const isAdmin = false
  const slug = slugify(displayName, {
    replacement: '-',
    lower: true
  })
  return firestore.doc(`user/${slug}`).set({
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

exports.onUpdate = functions.firestore.document('document/{slug}')
  .onUpdate(event => {
    const document = event.data.data()

    document.objectID = event.params.slug

    if (document.hasPreview) {
      const index = client.initIndex(ALGOLIA_INDEX_NAME)
      return index.saveObject(document)
    } else {
      return true
    }
  })

exports.newItem = functions.firestore.document('document/{slug}')
  .onWrite(event => {
    const document = event.data.data()

    // SENT FCM PUSH
    firestore.collection('user').get().then(users => {
      let tokens = []
      users.docs.forEach(user => {
        if (user.data().token) {
          tokens.push(user.data().token)
        }
      })

      const payload = {
        notification: {
          title: 'Yeni döküman yükledi!',
          body: `${document.displayName} yeni bir döküman yükledi.`,
          icon: document.photoURL
        }
      }

      if (tokens.length > 0) {
        return admin.messaging().sendToDevice(tokens, payload).then(response => {
          console.log(response)
        })
      } else {
        return true
      }
    })
  })
