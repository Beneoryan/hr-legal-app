const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// App URL for click_action
const APP_URL = 'https://hr-legal-app.netlify.app';
const APP_ICON = 'https://hr-legal-app.netlify.app/icons/icon-192x192.png';

/**
 * Helper: Get FCM token(s) for a specific user ID.
 * Returns an array of token strings.
 */
async function getTokensForUser(userId) {
  const doc = await db.collection('hrd_fcm_tokens').doc(userId).get();
  if (!doc.exists) return [];
  const data = doc.data();
  return data.token ? [data.token] : [];
}

/**
 * Helper: Get ALL FCM tokens from the collection.
 * Returns an array of {token, userId} objects.
 */
async function getAllTokens() {
  const snapshot = await db.collection('hrd_fcm_tokens').get();
  const tokens = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.token) {
      tokens.push({token: data.token, userId: doc.id});
    }
  });
  return tokens;
}

/**
 * Helper: Get all FCM tokens EXCEPT for a specific user.
 * Returns an array of {token, userId} objects.
 */
async function getAllTokensExcept(excludeUserId) {
  const allTokens = await getAllTokens();
  return allTokens.filter((t) => t.userId !== excludeUserId);
}

/**
 * Helper: Send push notification to multiple tokens and clean up invalid ones.
 */
async function sendToTokens(tokens, notification, data) {
  if (!tokens || tokens.length === 0) return;

  const tokenStrings = tokens.map((t) => (typeof t === 'string' ? t : t.token));
  if (tokenStrings.length === 0) return;

  const message = {
    notification: {
      title: notification.title || 'Notifikasi',
      body: notification.body || '',
      image: notification.icon || APP_ICON,
    },
    data: {
      click_action: data.click_action || APP_URL,
      type: data.type || 'general',
      title: notification.title || 'Notifikasi',
      body: notification.body || '',
    },
    tokens: tokenStrings,
  };

  const response = await messaging.sendEachForMulticast(message);

  // Clean up invalid/expired tokens
  if (response.failureCount > 0) {
    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokenStrings[idx]);
        }
      }
    });

    // Delete invalid tokens from Firestore
    if (failedTokens.length > 0) {
      const snapshot = await db.collection('hrd_fcm_tokens').get();
      const batch = db.batch();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (failedTokens.includes(data.token)) {
          batch.delete(doc.ref);
        }
      });
      await batch.commit();
      functions.logger.info(`Cleaned up ${failedTokens.length} invalid FCM token(s).`);
    }
  }

  functions.logger.info(
    `Sent notification: ${response.successCount} success, ${response.failureCount} failure.`,
  );
}

/**
 * Trigger: When a new notification document is created in hrd_notifikasi.
 * Sends push notification to the targeted user.
 * targetUser can be a user ID or a role string.
 */
exports.onNotifikasiCreated = functions.firestore
  .document('hrd_notifikasi/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const targetUser = data.targetUser;
    const title = data.title || 'Notifikasi Baru';
    const body = data.message || '';
    const link = data.link || APP_URL;

    let tokens = [];

    // Check if targetUser is a specific user ID or a role
    const userDoc = await db.collection('hrd_fcm_tokens').doc(targetUser).get();
    if (userDoc.exists) {
      // It's a specific user ID
      const userData = userDoc.data();
      if (userData.token) {
        tokens = [{token: userData.token, userId: targetUser}];
      }
    } else {
      // targetUser might be a role - send to all users with that role
      const roleSnapshot = await db.collection('hrd_fcm_tokens')
        .where('role', '==', targetUser)
        .get();
      roleSnapshot.forEach((doc) => {
        const docData = doc.data();
        if (docData.token) {
          tokens.push({token: docData.token, userId: doc.id});
        }
      });
    }

    await sendToTokens(
      tokens,
      {title, body, icon: APP_ICON},
      {click_action: link, type: 'notifikasi'},
    );
  });

/**
 * Trigger: When a new broadcast document is created in hrd_broadcast.
 * Sends push notification to ALL registered users.
 */
exports.onBroadcastCreated = functions.firestore
  .document('hrd_broadcast/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const title = 'Broadcast';
    const body = data.message || '';

    const tokens = await getAllTokens();

    await sendToTokens(
      tokens,
      {title, body, icon: APP_ICON},
      {click_action: APP_URL, type: 'broadcast'},
    );
  });

/**
 * Trigger: When a new meeting invite is created in hrd_meeting_invites.
 * Sends push notification to the target user.
 */
exports.onMeetingInviteCreated = functions.firestore
  .document('hrd_meeting_invites/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const targetUser = data.targetUser;
    const title = data.title || 'Undangan Meeting';
    const body = `Anda diundang ke meeting: ${title}`;

    const tokens = await getTokensForUser(targetUser);

    await sendToTokens(
      tokens.map((t) => ({token: t, userId: targetUser})),
      {title: 'Undangan Meeting', body, icon: APP_ICON},
      {click_action: APP_URL, type: 'meeting_invite'},
    );
  });

/**
 * Trigger: When a new pengumuman (announcement) is created in hrd_pengumuman.
 * Sends push notification to ALL registered users.
 */
exports.onPengumumanCreated = functions.firestore
  .document('hrd_pengumuman/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const title = data.judul || 'Pengumuman Baru';
    const body = data.isi || '';

    const tokens = await getAllTokens();

    await sendToTokens(
      tokens,
      {title, body, icon: APP_ICON},
      {click_action: APP_URL, type: 'pengumuman'},
    );
  });

/**
 * Trigger: When a new chat message is created in hrd_chat.
 * Sends push notification to all users EXCEPT the sender.
 */
exports.onChatCreated = functions.firestore
  .document('hrd_chat/{docId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const senderUserId = data.userId;
    const senderName = data.userName || 'Seseorang';
    const message = data.message || '';

    const tokens = await getAllTokensExcept(senderUserId);

    await sendToTokens(
      tokens,
      {title: `Pesan dari ${senderName}`, body: message, icon: APP_ICON},
      {click_action: APP_URL, type: 'chat'},
    );
  });
