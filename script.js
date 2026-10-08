const menuToggle = document.querySelector(".menu-toggle");
const siteNavigation = document.querySelector(".site-nav");
const lightbox = document.querySelector(".lightbox");
const lightboxImage = document.querySelector(".lightbox-image");
const lightboxCaption = document.querySelector(".lightbox-caption");
const themeToggle = document.querySelector(".theme-toggle");
const editorToggle = document.querySelector(".editor-toggle");
const editorPanel = document.querySelector(".editor-panel");
const editorStatus = document.querySelector(".editor-status");
const uploadInput = document.querySelector(".photo-upload-input");
const textStorageKey = "mara-portfolio-edits-v1";
const themeStorageKey = "mara-portfolio-theme-v1";
const contactStorageKey = "mara-portfolio-contact-v1";
const imageDatabaseName = "mara-portfolio-images";
const contactEmail = document.querySelector(".editor-email");
const instagramUrl = document.querySelector(".editor-instagram");
const exportButton = document.querySelector(".editor-export");
const savedText = new Map();
let activePhotoId = null;
let isEditing = false;
let savedPhotosLoadError = null;

function showEditorStatus(message, isError = false) {
  editorStatus.textContent = message;
  editorPanel.classList.toggle("has-error", isError);
  if (isError) {
    editorPanel.hidden = false;
  }
}

function readSavedText() {
  try {
    const stored = JSON.parse(localStorage.getItem(textStorageKey) || "{}");
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      Object.entries(stored).forEach(([id, text]) => {
        if (/^text-\d+$/.test(id) && typeof text === "string") {
          savedText.set(id, text);
        }
      });
    }
  } catch (error) {
    showEditorStatus("Could not load saved writing. Check this browser's storage settings.", true);
  }
}

function wrapEditableText() {
  const selectors = [
    "h1",
    "h2",
    "h3",
    "figcaption",
    ".hero-intro",
    ".hero-image .image-annotation",
    ".section-note",
    ".image-caption",
    ".essay-intro",
    ".essay-quote",
    ".about-copy p",
    ".about-facts strong",
    ".skills-list li > span:nth-child(2)",
    ".achievements-list strong",
    ".achievements-list li div > span",
    ".wordmark",
    ".contact-meta > a",
    ".contact-section > p:not(.eyebrow, .presentation-note)",
    ".contact-meta > span",
    ".site-footer > p",
    ".site-footer > span#current-year",
  ];
  const excluded = "[aria-hidden='true'], .presentation-note, .lightbox";
  let sequence = 0;

  document.querySelectorAll(selectors.join(",")).forEach((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (
          !node.nodeValue.trim() ||
          node.parentElement.closest(`${excluded}, i`) ||
          node.parentElement.closest("[data-editable-text]")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach((node) => {
      const id = `text-${sequence++}`;
      const original = node.nodeValue;
      const editable = document.createElement("span");
      editable.dataset.editableText = id;
      editable.textContent = savedText.get(id) ?? original;
      node.replaceWith(editable);
    });
  });
}

function saveEditableText(element) {
  const id = element.dataset.editableText;
  const text = element.textContent;
  savedText.set(id, text);
  try {
    localStorage.setItem(textStorageKey, JSON.stringify(Object.fromEntries(savedText)));
    showEditorStatus("Changes saved in this browser.");
    const card = element.closest(".work-card");
    if (card) {
      const button = card.querySelector(".image-button");
      const title = card.querySelector("h3")?.textContent.trim();
      const caption = card.querySelector(".image-caption")?.textContent.trim();
      const altText = caption || title || "Portfolio photograph";
      button.dataset.caption = [title, caption].filter(Boolean).join(" — ");
      button.dataset.alt = altText;
      button.setAttribute("aria-label", `Open photograph: ${altText}`);
      const image = button.querySelector("img");
      image.alt = altText;
    }
  } catch (error) {
    showEditorStatus("Could not save these changes. Check this browser's storage settings.", true);
  }
}

function setEditing(enabled) {
  isEditing = enabled;
  document.body.classList.toggle("is-editing", enabled);
  editorToggle.setAttribute("aria-pressed", String(enabled));
  editorToggle.textContent = enabled ? "FINISH EDITING" : "EDIT THIS SITE";
  editorPanel.hidden = !enabled && !editorPanel.classList.contains("has-error");
  document.querySelectorAll("[data-editable-text]").forEach((element) => {
    if (enabled) {
      element.setAttribute("contenteditable", "plaintext-only");
      element.setAttribute("tabindex", "0");
      element.setAttribute("title", "Click to edit. Changes are saved in this browser.");
      element.spellcheck = true;
      element.addEventListener("input", onEditableInput);
      element.addEventListener("keydown", onEditableKeyDown);
    } else {
      element.removeAttribute("contenteditable");
      element.removeAttribute("tabindex");
      element.removeAttribute("title");
      element.removeEventListener("input", onEditableInput);
      element.removeEventListener("keydown", onEditableKeyDown);
    }
  });
}

function onEditableInput(event) {
  saveEditableText(event.currentTarget);
}

function onEditableKeyDown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
  }
}

function setTheme(theme, persist = true) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#1e201e" : "#f3f1ec";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  themeToggle.querySelector(".theme-toggle-icon").textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-toggle-label").textContent = isDark ? "LIGHT MODE" : "DARK MODE";

  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch (error) {
      showEditorStatus("The theme changed, but this browser could not remember your preference.", true);
    }
  }
}

function restoreContactDetails() {
  const emailLink = document.querySelector(".contact-link");
  const instagramLink = document.querySelector(".contact-meta > a");
  contactEmail.value = emailLink.href.slice("mailto:".length).split("?")[0];
  instagramUrl.value = instagramLink.getAttribute("href") || "";

  try {
    const savedContact = JSON.parse(localStorage.getItem(contactStorageKey) || "{}");
    if (typeof savedContact.email === "string" && savedContact.email.trim()) {
      contactEmail.value = savedContact.email;
    }
    if (typeof savedContact.instagram === "string") {
      instagramUrl.value = savedContact.instagram;
    }
  } catch (error) {
    showEditorStatus("Could not load saved contact details. Check this browser's storage settings.", true);
  }
}

function saveContactDetails() {
  if (!contactEmail.validity.valid || !contactEmail.value.trim()) {
    contactEmail.reportValidity();
    showEditorStatus("Enter a valid contact email to update the contact link.", true);
    return;
  }

  let instagram = "";
  if (instagramUrl.value.trim()) {
    try {
      const parsedInstagram = new URL(instagramUrl.value.trim());
      if (!["http:", "https:"].includes(parsedInstagram.protocol)) {
        throw new Error("Use a web address that starts with https://.");
      }
      instagram = parsedInstagram.href;
    } catch (error) {
      showEditorStatus("Enter a valid Instagram web address starting with https://.", true);
      return;
    }
  }

  try {
    localStorage.setItem(
      contactStorageKey,
      JSON.stringify({ email: contactEmail.value.trim(), instagram }),
    );
    const [emailName, emailDomain] = contactEmail.value.trim().split("@");
    document.querySelector(".contact-link").href =
      `mailto:${encodeURIComponent(emailName)}@${encodeURIComponent(emailDomain)}?subject=Photography%20inquiry`;
    const instagramLink = document.querySelector(".contact-meta > a");
    if (instagram) {
      instagramLink.href = instagram;
    } else {
      instagramLink.removeAttribute("href");
    }
    showEditorStatus("Contact details saved in this browser.");
  } catch (error) {
    showEditorStatus("Could not save your contact details. Check this browser's storage settings.", true);
  }
}

function openImageDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support saved photo editing."));
      return;
    }

    const request = indexedDB.open(imageDatabaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("photos")) {
        request.result.createObjectStore("photos");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open photo storage."));
    request.onblocked = () => reject(new Error("Close other open portfolio tabs to update photo storage."));
  });
}

function storePhoto(id, blob) {
  return openImageDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction("photos", "readwrite");
    transaction.objectStore("photos").put(blob, id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Could not save this photograph."));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Could not save this photograph."));
    };
  }));
}

function clearSavedPhotos() {
  return openImageDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction("photos", "readwrite");
    transaction.objectStore("photos").clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Could not reset saved photographs."));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Could not reset saved photographs."));
    };
  }));
}

function loadPhoto(id) {
  return openImageDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction("photos", "readonly");
    const request = transaction.objectStore("photos").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not load a saved photograph."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Could not load saved photographs."));
    };
  }));
}

async function restoreSavedPhotos() {
  const images = [...document.querySelectorAll("[data-editable-image]")];

  for (const image of images) {
    const blob = await loadPhoto(image.dataset.editableImage);
    if (blob instanceof Blob) {
      image.src = URL.createObjectURL(blob);
      const lightboxButton = image.closest(".image-button");
      if (lightboxButton) {
        lightboxButton.dataset.image = image.src;
      }
    }
  }
}

function addPhotoControls() {
  document.querySelectorAll("[data-editable-image]").forEach((image) => {
    const owner = image.closest(".work-card") || image.closest("figure");
    if (!owner) {
      return;
    }

    owner.classList.add("photo-editor-parent");
    const control = document.createElement("button");
    control.className = "photo-editor-button";
    control.type = "button";
    control.textContent = "REPLACE PHOTO";
    control.setAttribute("aria-label", `Replace ${image.alt || "portfolio"} photograph`);
    control.hidden = true;
    control.addEventListener("click", () => {
      activePhotoId = image.dataset.editableImage;
      uploadInput.click();
    });
    owner.append(control);
  });
}

function stylesheetText() {
  const localStyleSheet = [...document.styleSheets].find(
    (sheet) => sheet.href && new URL(sheet.href).pathname.endsWith("/style.css"),
  );

  if (!localStyleSheet) {
    throw new Error("Could not find the portfolio's styles. Reload the page and try again.");
  }

  try {
    return [...localStyleSheet.cssRules].map((rule) => rule.cssText).join("\n");
  } catch (error) {
    throw new Error("Could not read the portfolio's styles. Open the original portfolio and try again.");
  }
}

function readImageAsDataUrl(blob, label) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.startsWith("data:image/")) {
        resolve(reader.result);
      } else {
        reject(new Error(`Could not prepare "${label}" for the downloaded portfolio.`));
      }
    };
    reader.onerror = () => reject(
      new Error(`Could not read "${label}". Try replacing this photograph and exporting again.`),
    );
    reader.readAsDataURL(blob);
  });
}

async function imageAsDataUrl(image) {
  const label = image.alt || "portfolio photograph";
  let response;
  try {
    response = await fetch(image.currentSrc || image.src, {
      mode: "cors",
      credentials: "omit",
    });
  } catch (error) {
    throw new Error(`Could not download "${label}". Try replacing this photo or use an image host that allows downloads.`);
  }

  if (!response.ok) {
    throw new Error(`Could not download "${label}" (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error(`"${label}" did not download as an image. Replace it and try again.`);
  }

  return readImageAsDataUrl(blob, label);
}

function makeStandaloneScript() {
  return `
(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector(".theme-toggle");
  const menuToggle = document.querySelector(".menu-toggle");
  const siteNavigation = document.querySelector(".site-nav");
  const lightbox = document.querySelector(".lightbox");
  const lightboxImage = document.querySelector(".lightbox-image");
  const lightboxCaption = document.querySelector(".lightbox-caption");

  themeToggle.addEventListener("click", () => {
    const isDark = root.dataset.theme !== "dark";
    root.dataset.theme = isDark ? "dark" : "light";
    root.style.colorScheme = isDark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').content = isDark ? "#1e201e" : "#f3f1ec";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", "Switch to " + (isDark ? "light" : "dark") + " mode");
    themeToggle.querySelector(".theme-toggle-icon").textContent = isDark ? "☀" : "☾";
    themeToggle.querySelector(".theme-toggle-label").textContent = isDark ? "LIGHT MODE" : "DARK MODE";
  });

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    siteNavigation.classList.toggle("is-open", isOpen);
  });

  siteNavigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      menuToggle.setAttribute("aria-expanded", "false");
      siteNavigation.classList.remove("is-open");
    }
  });

  document.querySelectorAll(".image-button").forEach((button) => {
    button.addEventListener("click", () => {
      lightboxImage.src = button.dataset.image;
      lightboxImage.alt = button.dataset.alt;
      lightboxCaption.textContent = button.dataset.caption;
      lightbox.showModal();
    });
  });

  document.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("close", () => lightboxImage.removeAttribute("src"));
  document.querySelector("#current-year").textContent = new Date().getFullYear();
})();
`;
}

async function createStandalonePortfolio() {
  await savedPhotosReady;
  if (savedPhotosLoadError) {
    throw new Error("Could not load your saved photographs. Check browser photo storage before downloading.");
  }

  const sourceImages = [...document.querySelectorAll("[data-editable-image]")];
  const photoData = await Promise.all(sourceImages.map(async (image) => ({
    id: image.dataset.editableImage,
    dataUrl: await imageAsDataUrl(image),
  })));
  const standalone = document.documentElement.cloneNode(true);

  standalone.querySelectorAll("script").forEach((script) => script.remove());
  standalone.querySelectorAll(
    ".editor-toggle, .editor-panel, .photo-upload-input, .photo-editor-button",
  ).forEach((element) => element.remove());

  standalone.querySelectorAll("[data-editable-text]").forEach((element) => {
    element.replaceWith(...element.childNodes);
  });

  standalone.querySelectorAll("[data-editable-image]").forEach((image) => {
    const photo = photoData.find((item) => item.id === image.dataset.editableImage);
    if (!photo) {
      throw new Error(`Could not package "${image.alt || "a portfolio photograph"}". Try exporting again.`);
    }

    image.src = photo.dataUrl;
    image.removeAttribute("data-editable-image");
    const button = image.closest(".image-button");
    if (button) {
      button.dataset.image = photo.dataUrl;
    }
  });

  standalone.querySelectorAll("[contenteditable]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute("tabindex");
    element.removeAttribute("title");
  });

  const photographerName = document.querySelector(".wordmark").textContent
    .replace(/\u00ae/g, "")
    .replace(/\s+/g, " ")
    .trim();
  standalone.querySelector("title").textContent = `${photographerName} — Photographer & Visual Storyteller`;
  standalone.querySelector('meta[name="description"]').content =
    `Selected photographs, documentary projects, and visual essays by ${photographerName}.`;

  const originalStylesheet = standalone.querySelector('link[rel="stylesheet"][href="style.css"]');
  if (!originalStylesheet) {
    throw new Error("Could not prepare the portfolio stylesheet for download.");
  }

  const embeddedStylesheet = document.createElement("style");
  embeddedStylesheet.textContent = stylesheetText();
  originalStylesheet.replaceWith(embeddedStylesheet);

  const standaloneScript = document.createElement("script");
  standaloneScript.textContent = makeStandaloneScript();
  standalone.querySelector("body").append(standaloneScript);

  return `<!doctype html>\n${standalone.outerHTML}`;
}

function makeDownloadFilename() {
  const name = [...document.querySelectorAll(".wordmark")]
    .map((wordmark) => wordmark.textContent.trim())
    .find(Boolean) || "photography portfolio";
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "photography-portfolio"}.html`;
}

async function downloadStandalonePortfolio() {
  exportButton.disabled = true;
  showEditorStatus("Preparing your website and embedding its photographs…");

  try {
    const html = await createStandalonePortfolio();
    const file = new Blob([html], { type: "text/html;charset=utf-8" });
    const objectUrl = URL.createObjectURL(file);
    const filename = makeDownloadFilename();
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    showEditorStatus(`Downloaded "${filename}". Share the HTML file, or upload it to a web host to get a link.`);
  } catch (error) {
    showEditorStatus(error.message || "Could not prepare your portfolio download.", true);
  } finally {
    exportButton.disabled = false;
  }
}

async function resizePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not prepare this image in your browser.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not resize this image."))),
      "image/jpeg",
      0.86,
    );
  });
}

async function replacePhoto(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file, such as a JPG, PNG, or WebP.");
  }

  const blob = await resizePhoto(file);
  await storePhoto(activePhotoId, blob);
  const image = document.querySelector(`[data-editable-image="${CSS.escape(activePhotoId)}"]`);
  const imageUrl = URL.createObjectURL(blob);
  image.src = imageUrl;
  const lightboxButton = image.closest(".image-button");

  if (lightboxButton) {
    lightboxButton.dataset.image = imageUrl;
    const caption = image.closest(".work-card")?.querySelector(".image-caption")?.textContent.trim();
    const description = caption || image.alt || "Portfolio photograph";
    image.alt = description;
    lightboxButton.dataset.alt = description;
    lightboxButton.setAttribute("aria-label", `Open photograph: ${description}`);
  }

  showEditorStatus("Photo replaced and saved in this browser.");
}

function updateMenu(open) {
  menuToggle.setAttribute("aria-expanded", String(open));
  siteNavigation.classList.toggle("is-open", open);
}

menuToggle.addEventListener("click", () => {
  updateMenu(menuToggle.getAttribute("aria-expanded") !== "true");
});

siteNavigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    updateMenu(false);
  }
});

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

contactEmail.addEventListener("change", saveContactDetails);
instagramUrl.addEventListener("change", saveContactDetails);

editorToggle.addEventListener("click", () => {
  const enabled = editorToggle.getAttribute("aria-pressed") !== "true";
  setEditing(enabled);
  editorPanel.classList.remove("has-error");
  if (enabled) {
    showEditorStatus("Select any highlighted text to edit it. Replace photographs using their photo buttons.");
    if (window.matchMedia("(max-width: 600px)").matches) {
      updateMenu(false);
    }
    editorPanel.hidden = false;
    document.querySelectorAll(".photo-editor-button").forEach((button) => {
      button.hidden = false;
    });
  } else {
    document.querySelectorAll(".photo-editor-button").forEach((button) => {
      button.hidden = true;
    });
  }
});

document.querySelector(".editor-done").addEventListener("click", () => setEditing(false));

editorPanel.addEventListener("click", async (event) => {
  if (event.target.closest(".editor-export")) {
    await downloadStandalonePortfolio();
    return;
  }

  if (event.target.closest(".editor-reset")) {
    if (window.confirm("Reset the text, photos, and theme to their original sample?")) {
      try {
        localStorage.removeItem(textStorageKey);
        localStorage.removeItem(themeStorageKey);
        localStorage.removeItem(contactStorageKey);
        await clearSavedPhotos();
        window.location.reload();
      } catch (error) {
        showEditorStatus(error.message || "Could not reset this portfolio's saved edits.", true);
      }
    }
  }
});

uploadInput.addEventListener("change", async () => {
  const [file] = uploadInput.files;
  uploadInput.value = "";
  if (!file || !activePhotoId) {
    return;
  }

  try {
    await replacePhoto(file);
  } catch (error) {
    showEditorStatus(error.message || "Could not save this photograph.", true);
  }
});

document.querySelectorAll(".image-button").forEach((button) => {
  button.addEventListener("click", () => {
    lightboxImage.src = button.dataset.image;
    lightboxImage.alt = button.dataset.alt;
    lightboxCaption.textContent = button.dataset.caption;
    lightbox.showModal();
  });
});

document.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    lightbox.close();
  }
});

lightbox.addEventListener("close", () => lightboxImage.removeAttribute("src"));

document.addEventListener("click", (event) => {
  if (isEditing && event.target.closest("[data-editable-text]")?.closest("a")) {
    event.preventDefault();
  }
});

readSavedText();
wrapEditableText();
restoreContactDetails();
addPhotoControls();
document.querySelector("#current-year").textContent = new Date().getFullYear();

let initialTheme = "light";
try {
  const storedTheme = localStorage.getItem(themeStorageKey);
  if (storedTheme === "dark" || storedTheme === "light") {
    initialTheme = storedTheme;
  }
} catch (error) {
  showEditorStatus("This browser could not access saved display preferences.", true);
}
setTheme(initialTheme, false);

const savedPhotosReady = restoreSavedPhotos().catch((error) => {
  savedPhotosLoadError = error;
  if (error.name !== "NotFoundError") {
    showEditorStatus(`${error.message || "Could not load saved photos."} Text editing and theme controls remain available.`, true);
  }
});
