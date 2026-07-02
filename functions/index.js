const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// App URL for click_action
const APP_URL = "https://hr-legal-app.netlify.app";
const APP_ICON = "https://hr-legal-app.netlify.app/icons/icon-192x192.png";

function normalizeWaNumber(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

/**
 * Helper: Get FCM token(s) for a specific user ID.
 * Reads from subcollection: hrd_fcm_tokens/{userId}/devices/*
 * Returns an array of {token, docPath} objects for stale token cleanup.
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
      tokens.push({
        token: data.token,
        docPath: `hrd_fcm_tokens/${userId}/devices/${doc.id}`,
      });
    }
  });
  return tokens;
}

/**
 * Helper: Get ALL FCM tokens from all users.
 * Uses collectionGroup query on 'devices' to avoid N+1 sequential reads.
 * Returns an array of {token, userId, docPath} objects.
 */
async function getAllTokens() {
  const devicesSnap = await db.collectionGroup("devices").get();
  const tokens = [];
  devicesSnap.forEach((deviceDoc) => {
    const data = deviceDoc.data();
    if (data.token) {
      tokens.push({
        token: data.token,
        userId: data.userId || deviceDoc.ref.parent.parent.id,
        docPath: deviceDoc.ref.path,
      });
    }
  });
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
      tokens = userTokens;
    } else {
      // targetUser might be a role - use collectionGroup query for efficiency
      const devicesSnap = await db
        .collectionGroup("devices")
        .where("role", "==", targetUser)
        .get();
      devicesSnap.forEach((deviceDoc) => {
        const deviceData = deviceDoc.data();
        if (deviceData.token) {
          tokens.push({
            token: deviceData.token,
            userId: deviceData.userId || deviceDoc.ref.parent.parent.id,
            docPath: deviceDoc.ref.path,
          });
        }
      });
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
      userTokens,
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

/**
 * Trigger: When a new WhatsApp outbox document is created in hrd_wa_outbox.
 * Sends message via configured WhatsApp gateway so message is sent from one
 * registered admin/sender number managed by the gateway account.
 */
exports.onWaOutboxCreated = functions.firestore
  .document("hrd_wa_outbox/{docId}")
  .onCreate(async (snap) => {
    const data = snap.data() || {};
    const docRef = snap.ref;

    const targetNumber = normalizeWaNumber(data.targetNumber || data.to || "");
    const message = String(data.message || "").trim();

    if (!targetNumber || !message) {
      await docRef.set(
        {
          status: "failed",
          failedAt: new Date().toISOString(),
          error: "targetNumber atau message kosong.",
        },
        {merge: true},
      );
      return;
    }

    const cfgSnap = await db.collection("hrd_settings").doc("perusahaan").get();
    const cfg = cfgSnap.exists ? cfgSnap.data() || {} : {};
    const provider = String(cfg.waProvider || "fonnte").toLowerCase();
    const apiUrl = String(cfg.waApiUrl || "").trim();
    const apiToken = String(cfg.waApiToken || "").trim();

    if (!apiUrl || !apiToken) {
      await docRef.set(
        {
          status: "failed",
          failedAt: new Date().toISOString(),
          error: "WA gateway belum dikonfigurasi (waApiUrl/waApiToken).",
        },
        {merge: true},
      );
      return;
    }

    let requestBody;
    let headers;

    if (provider === "fonnte") {
      requestBody = {
        target: targetNumber,
        message,
        countryCode: "62",
      };
      headers = {
        "Content-Type": "application/json",
        Authorization: apiToken,
      };
    } else {
      requestBody = {
        to: targetNumber,
        message,
      };
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      };
    }

    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      const raw = await resp.text();
      const responseSnippet = raw ? raw.slice(0, 500) : "";

      if (!resp.ok) {
        await docRef.set(
          {
            status: "failed",
            failedAt: new Date().toISOString(),
            provider,
            httpStatus: resp.status,
            error: `Gateway error ${resp.status}`,
            responseSnippet,
          },
          {merge: true},
        );
        return;
      }

      await docRef.set(
        {
          status: "sent",
          sentAt: new Date().toISOString(),
          provider,
          httpStatus: resp.status,
          responseSnippet,
        },
        {merge: true},
      );
    } catch (e) {
      await docRef.set(
        {
          status: "failed",
          failedAt: new Date().toISOString(),
          provider,
          error: e.message || "Unknown WA gateway error",
        },
        {merge: true},
      );
    }
  });

// NOTE: onChatCreated has been intentionally removed.
// Chat messages already send targeted notifications via the hrd_notifikasi collection
// (see sendNotification() in core.js), which triggers onNotifikasiCreated above.
// Having a separate chat trigger caused a notification blast to all users regardless
// of whether they were participants in the conversation.
