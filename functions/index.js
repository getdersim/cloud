'use strict';var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const slugify = require('slugify');
const firestore = admin.firestore();
const algoliasearch = require('algoliasearch');

const client = algoliasearch(functions.config().algolia.app_id, functions.config().algolia.api_key);

// Name fo the algolia index for Blog posts content.
const ALGOLIA_INDEX_NAME = 'documents';

exports.register = functions.auth.user().onCreate((() => {var _ref = (0, _asyncToGenerator3.default)(function* (event) {
    const user = event.data; // The Firebase user.

    const { email, displayName, photoURL, uid } = user; // Details of the user.
    const isAdmin = false;

    let slug = slugify(displayName, {
      replacement: ' ',
      lower: true }).
    split(' ').join('');
    // Check user slug
    let userSnapshot = yield firestore.collection('user').where('slug', '==', slug).get();
    if (userSnapshot.docs.length > 0) {
      slug = `${slug}-${userSnapshot.docs.length}`;
    }

    return firestore.doc(`user/${uid}`).set({
      email,
      displayName,
      photoURL,
      uid,
      isAdmin,
      slug,
      followers: [] });

  });return function (_x) {return _ref.apply(this, arguments);};})());

exports.onDocumentUpdate = functions.firestore.document('document/{slug}').
onUpdate(event => {
  const document = event.data.data();

  document.objectID = event.params.slug;

  if (document.hasPreview && !document.doc && document.text) {
    let { slug, description, date, displayName, title, text, thumbnail, userSlug, objectID } = document;
    const index = client.initIndex(ALGOLIA_INDEX_NAME);
    index.saveObject({ objectID, slug, description, date, displayName, title, text, thumbnail, userSlug });
    return event.data.ref.update({
      text: null,
      doc: null });

  } else {
    return true;
  }
});

exports.onDocumentDelete = functions.firestore.document('document/{slug}').
onDelete(event => {
  const document = event.data.previous.data();

  document.objectID = event.params.slug;

  firestore.doc(`pdf/${document.slug}`).delete().catch(console.log);

  return client.deleteObject(document.slug, err => {
    if (err) {
      console.log(err);
    } else {
      console.log('Remove success', document.slug);
    }
  });
});

exports.onDocumentCreate = functions.firestore.document('document/{slug}').
onCreate(event => {
  const document = event.data.data();

  // SENT FCM PUSH
  firestore.collection('user').get().then(users => {
    let tokens = [];
    users.docs.forEach(user => {
      if (user.data().token) {
        tokens.push(user.data().token);
      }
    });

    const payload = {
      notification: {
        title: 'Yeni döküman yükledi!',
        body: `${document.displayName} yeni bir döküman yükledi.`,
        icon: document.photoURL } };



    if (tokens.length > 0) {
      return admin.messaging().sendToDevice(tokens, payload).then(response => {
        console.log(response);
      });
    } else {
      return true;
    }
  });
});