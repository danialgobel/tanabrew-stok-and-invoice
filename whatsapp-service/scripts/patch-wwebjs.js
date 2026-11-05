import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const utilsPath = path.resolve(__dirname, "../node_modules/whatsapp-web.js/src/util/Injected/Utils.js");

if (fs.existsSync(utilsPath)) {
  let content = fs.readFileSync(utilsPath, "utf8");

  let modified = false;

  // 1. Fix message __x_id collision on send
  if (!content.includes("delete message.__x_id;")) {
    const target = "if (botOptions) {\n            delete message.canonicalUrl;\n        }";
    const replacement = `if (botOptions) {\n            delete message.canonicalUrl;\n        }\n\n        delete message.__x_id;\n        delete message.id;\n        message.id = newMsgKey;`;
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      modified = true;
    }
  }

  // 2. Safeguard getMessageModel
  if (!content.includes("msg?.id || { _serialized:")) {
    const target = `    window.WWebJS.getMessageModel = (message) => {
        const msg = message.serialize();`;
    const replacement = `    window.WWebJS.getMessageModel = (message) => {
        if (!message) return null;
        try {
            const msg = (typeof message.serialize === 'function')
                ? message.serialize()
                : (message.toJSON ? message.toJSON() : { id: message.id });`;
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(utilsPath, content, "utf8");
    console.log("✅ Successfully patched whatsapp-web.js Utils.js");
  } else {
    console.log("ℹ️ whatsapp-web.js Utils.js is already patched.");
  }
} else {
  console.warn("⚠️ Utils.js not found at:", utilsPath);
}
