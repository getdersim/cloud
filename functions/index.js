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

  // TODO @cagatay burada es7 compile et ve async await çalışır olsun, sonrasında slug boş mu dolu mu kontrol et ona göre -1 -2 ekle

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

exports.onDocumentUpdate = functions.firestore.document('document/{slug}')
  .onUpdate(event => {
    const document = event.data.data()

    document.objectID = event.params.slug

    if (document.hasPreview && !document.doc && document.text) {
      let {slug, description, date, displayName, title, text, thumbnail, userSlug, objectID} = document
      const index = client.initIndex(ALGOLIA_INDEX_NAME)
      index.saveObject({objectID, slug, description, date, displayName, title, text, thumbnail, userSlug})
      return event.data.ref.update({
        text: null,
        doc: null
      })
    } else {
      return true
    }
  })

exports.onDocumentDelete = functions.firestore.document('document/{slug}')
  .onDelete(event => {
    const document = event.data.data()

    document.objectID = event.params.slug

    return client.deleteObject(document.slug, err => {
      if (err) {
        console.log(err)
      } else {
        console.log('Remove success', document.slug)
      }
    })
  })

exports.onDocumentCreate = functions.firestore.document('document/{slug}')
  .onCreate(event => {
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
