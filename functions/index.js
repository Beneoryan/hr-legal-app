const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// App URL for click_action
const APP_URL = "https://hr-legal-app.netlify.app";
const APP_ICON = "https://hr-legal-app.netlify.app/icons/icon-192x192.png";

/**
 * Helper: Get FCM token(s) for a specific user ID.
 * Reads from subcollection: hrd_fcm_tokens/{userId}/devices/*
 * Returns an array of token strings (supports multiple devices per user).
 */
async function getTokensForUser(userId) {
  const devicesSnap = await db
    .collection("hrd_fcm_tokens")
    .doc(userId)
    .collection("devices")
    .get();
  const tokens = [];
  devicesSnap.forEach((doc) => {
    const data = doc.data();
    if (data.token) {
      tokens.push(data.token);
    }
  });
  return tokens;
}

/**
 * Helper: Get ALL FCM tokens from all users.
 * Reads from subcollection model: hrd_fcm_tokens/{userId}/devices/*
 * Returns an array of {token, userId, docPath} objects.
 */
async function getAllTokens() {
  const usersSnap = await db.collection("hrd_fcm_tokens").get();
  const tokens = [];
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const devicesSnap = await userDoc.ref.collection("devices").get();
    devicesSnap.forEach((deviceDoc) => {
      const data = deviceDoc.data();
      if (data.token) {
        tokens.push({
          token: data.token,
          userId: userId,
          docPath: `hrd_fcm_tokens/${userId}/devices/${deviceDoc.id}`,
        });
      }
    });
  }
  return tokens;
}

/**
 * Helper: Send push notification to multiple tokens and clean up invalid ones.
 */
async function sendToTokens(tokens, notification, data) {
  if (!tokens || tokens.length === 0) return;

  const tokenStrings = tokens.map((t) => (typeof t === "string" ? t : t.token));
  if (tokenStrings.length === 0) return;

  const message = {
    notification: {
      title: notification.title || "Notifikasi",
      body: notification.body || "",
      image: notification.icon || APP_ICON,
    },
    data: {
      click_action: data.click_action || APP_URL,
      type: data.type || "general",
      title: notification.title || "Notifikasi",
      body: notification.body || "",
    },
    tokens: tokenStrings,
  };

  const response = await messaging.sendEachForMulticast(message);

  // Clean up invalid/expired tokens
  if (response.failureCount > 0) {
    const batch = db.batch();
    let cleanedCount = 0;

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        if (
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/registration-token-not-registered"
        ) {
          // Find the token entry that has docPath for direct deletion
          const tokenEntry = tokens[idx];
          if (tokenEntry && tokenEntry.docPath) {
            batch.delete(db.doc(tokenEntry.docPath));
            cleanedCount++;
          }
        }
      }
    });

    if (cleanedCount > 0) {
      await batch.commit();
      functions.logger.info(`Cleaned up ${cleanedCount} invalid FCM token(s).`);
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
  .document("hrd_notifikasi/{docId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const targetUser = data.targetUser;
    const title = data.title || "Notifikasi Baru";
    const body = data.message || "";
    const link = data.link || APP_URL;

    let tokens = [];

    // Try to get tokens for a specific user ID first
    const userTokens = await getTokensForUser(targetUser);
    if (userTokens.length > 0) {
      tokens = userTokens.map((t) => ({
        token: t,
        userId: targetUser,
        docPath: null,
      }));
    } else {
      // targetUser might be a role - query devices subcollections for role match
      const usersSnap = await db.collection("hrd_fcm_tokens").get();
      for (const userDoc of usersSnap.docs) {
        const devicesSnap = await userDoc.ref.collection("devices").get();
        devicesSnap.forEach((deviceDoc) => {
          const deviceData = deviceDoc.data();
          if (deviceData.role === targetUser && deviceData.token) {
            tokens.push({
              token: deviceData.token,
              userId: userDoc.id,
              docPath: `hrd_fcm_tokens/${userDoc.id}/devices/${deviceDoc.id}`,
            });
          }
        });
      }
    }

    await sendToTokens(
      tokens,
      { title, body, icon: APP_ICON },
      { click_action: link, type: "notifikasi" },
    );
  });

/**
 * Trigger: When a new broadcast document is created in hrd_broadcast.
 * Sends push notification to ALL registered users.
 */
exports.onBroadcastCreated = functions.firestore
  .document("hrd_broadcast/{docId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const title = "Broadcast";
    const body = data.message || "";

    const tokens = await getAllTokens();

    await sendToTokens(
      tokens,
      { title, body, icon: APP_ICON },
      { click_action: APP_URL, type: "broadcast" },
    );
  });

/**
 * Trigger: When a new meeting invite is created in hrd_meeting_invites.
 * Sends push notification to the target user.
 */
exports.onMeetingInviteCreated = functions.firestore
  .document("hrd_meeting_invites/{docId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const targetUser = data.targetUser;
    const title = data.title || "Undangan Meeting";
    const body = `Anda diundang ke meeting: ${title}`;

    const userTokens = await getTokensForUser(targetUser);

    await sendToTokens(
      userTokens.map((t) => ({ token: t, userId: targetUser, docPath: null })),
      { title: "Undangan Meeting", body, icon: APP_ICON },
      { click_action: APP_URL, type: "meeting_invite" },
    );
  });

/**
 * Trigger: When a new pengumuman (announcement) is created in hrd_pengumuman.
 * Sends push notification to ALL registered users.
 */
exports.onPengumumanCreated = functions.firestore
  .document("hrd_pengumuman/{docId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const title = data.judul || "Pengumuman Baru";
    const body = data.isi || "";

    const tokens = await getAllTokens();

    await sendToTokens(
      tokens,
      { title, body, icon: APP_ICON },
      { click_action: APP_URL, type: "pengumuman" },
    );
  });

// NOTE: onChatCreated has been intentionally removed.
// Chat messages already send targeted notifications via the hrd_notifikasi collection
// (see sendNotification() in core.js), which triggers onNotifikasiCreated above.
// Having a separate chat trigger caused a notification blast to all users regardless
// of whether they were participants in the conversation.
