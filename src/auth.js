const crypto = require("crypto");

const OWNER_PHONE = process.env.OWNER_PHONE;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const AGENT_SECRET = process.env.AGENT_SECRET || "dev-secret";

function isAuthorizedSender(phone) {
  if (!OWNER_PHONE) {
    console.warn("[AUTH] OWNER_PHONE not set — all messages blocked");
    return false;
  }
  const normalized = phone.replace(/\D/g, "");
  const owner = OWNER_PHONE.replace(/\D/g, "");
  return normalized === owner;
}

function verifyWhatsAppSignature(rawBody, signatureHeader) {
  if (!WHATSAPP_APP_SECRET) return true;
  if (!signatureHeader) return false;
  const expected = "sha256=" + crypto
    .createHmac("sha256", WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

function verifyAgentToken(token) {
  if (!token) return false;
  const expected = crypto
    .createHmac("sha256", AGENT_SECRET)
    .update("agent-auth")
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

function generateAgentToken() {
  return crypto
    .createHmac("sha256", AGENT_SECRET)
    .update("agent-auth")
    .digest("hex");
}

module.exports = {
  isAuthorizedSender,
  verifyWhatsAppSignature,
  verifyAgentToken,
  generateAgentToken,
};
