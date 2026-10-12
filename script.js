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
const extraPhotoInput = document.querySelector(".extra-photo-input");
const textStorageKey = "mara-portfolio-edits-v1";
const themeStorageKey = "mara-portfolio-theme-v1";
const contactStorageKey = "mara-portfolio-contact-v1";
const extraPhotosStorageKey = "mara-portfolio-extra-photos-v1";
const linkServiceStorageKey = "mara-portfolio-link-service-v1";
const imageDatabaseName = "mara-portfolio-images";
const contactEmail = document.querySelector(".editor-email");
const instagramUrl = document.querySelector(".editor-instagram");
const exportButton = document.querySelector(".editor-export");
const linkManager = document.querySelector(".link-manager");
const linkServiceUrl = document.querySelector(".link-service-url");
const linkAdminSecret = document.querySelector(".link-admin-secret");
const linkManagerStatus = document.querySelector(".link-manager-status");
const linkList = document.querySelector(".link-list");
const savedText = new Map();
const managedLinkTokens = new Map();
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
        if (/^(?:text-\d+|photo-(?:title|caption)-extra-[a-f0-9-]+)$/.test(id) && typeof text === "string") {
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
    if (element.closest(".custom-work-card")) {
      return;
    }
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
  document.querySelectorAll(".photo-editor-button").forEach((button) => {
    button.hidden = !enabled;
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
      uploadInput.multiple = false;
      uploadInput.click();
    });
    owner.append(control);
  });
}

function readExtraPhotoEntries() {
  try {
    const stored = JSON.parse(localStorage.getItem(extraPhotosStorageKey) || "[]");
    if (!Array.isArray(stored)) {
      throw new Error("Saved extra photo details are not in the expected format.");
    }

    return stored.filter((entry) => (
      entry &&
      typeof entry.id === "string" &&
      /^extra-[a-f0-9-]{36}$/.test(entry.id) &&
      typeof entry.title === "string" &&
      typeof entry.caption === "string"
    ));
  } catch (error) {
    showEditorStatus("Could not load the extra photo list. Check this browser's storage settings.", true);
    return [];
  }
}

function saveExtraPhotoEntries(entries) {
  try {
    localStorage.setItem(extraPhotosStorageKey, JSON.stringify(entries));
  } catch (error) {
    throw new Error("The photo was saved, but its gallery details could not be stored. Check this browser's storage settings.");
  }
}

function addCustomEditableText(element, id, initialText) {
  const editable = document.createElement("span");
  editable.dataset.editableText = id;
  editable.textContent = savedText.get(id) ?? initialText;
  element.replaceChildren(editable);
  if (isEditing) {
    editable.setAttribute("contenteditable", "plaintext-only");
    editable.setAttribute("tabindex", "0");
    editable.setAttribute("title", "Click to edit. Changes are saved in this browser.");
    editable.addEventListener("input", onEditableInput);
    editable.addEventListener("keydown", onEditableKeyDown);
  }
}

function makeCustomWorkCard(entry, imageUrl = "") {
  const card = document.createElement("article");
  card.className = "work-card work-card-wide custom-work-card";
  card.dataset.category = "portrait";

  const imageButton = document.createElement("button");
  imageButton.className = "image-button";
  imageButton.type = "button";
  imageButton.dataset.image = imageUrl;
  imageButton.dataset.alt = entry.title || "Portfolio photograph";
  imageButton.dataset.caption = [entry.title, entry.caption].filter(Boolean).join(" — ");
  imageButton.setAttribute("aria-label", `Open photograph: ${entry.title || "Portfolio photograph"}`);

  const image = document.createElement("img");
  image.dataset.editableImage = entry.id;
  image.src = imageUrl;
  image.alt = entry.title || "Portfolio photograph";
  image.loading = "lazy";

  const openImage = document.createElement("span");
  openImage.className = "open-image";
  openImage.setAttribute("aria-hidden", "true");
  openImage.textContent = "↗";
  imageButton.append(image, openImage);

  const caption = document.createElement("div");
  caption.className = "card-caption";
  const headingGroup = document.createElement("div");
  const category = document.createElement("p");
  category.className = "card-category";
  category.textContent = "NEW PHOTOGRAPH";
  const title = document.createElement("h3");
  addCustomEditableText(title, `photo-title-${entry.id}`, entry.title);
  headingGroup.append(category, title);

  const description = document.createElement("p");
  description.className = "image-caption";
  addCustomEditableText(description, `photo-caption-${entry.id}`, entry.caption);
  caption.append(headingGroup, description);
  card.append(imageButton, caption);
  return card;
}

function renderExtraPhotos(entries) {
  const grid = document.querySelector(".portfolio-grid");
  entries.forEach((entry) => {
    grid.append(makeCustomWorkCard(entry));
  });
}

async function addMorePhotos(files) {
  const entries = readExtraPhotoEntries();
  const grid = document.querySelector(".portfolio-grid");
  let added = 0;

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error(`"${file.name}" is not an image. Choose JPG, PNG, or WebP files.`);
    }
    const blob = await resizePhoto(file);
    const id = `extra-${crypto.randomUUID().toLowerCase()}`;
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "New photograph";
    const entry = { id, title, caption: "" };
    await storePhoto(id, blob);
    saveExtraPhotoEntries([...entries, entry]);
    entries.push(entry);
    const imageUrl = URL.createObjectURL(blob);
    const card = makeCustomWorkCard(entry, imageUrl);
    grid.append(card);
    const image = card.querySelector("img");
    const button = card.querySelector(".photo-editor-button");
    if (button) {
      button.hidden = !isEditing;
    }
    if (isEditing) {
      card.querySelectorAll("[data-editable-text]").forEach((element) => {
        element.setAttribute("contenteditable", "plaintext-only");
        element.setAttribute("tabindex", "0");
        element.setAttribute("title", "Click to edit. Changes are saved in this browser.");
        element.addEventListener("input", onEditableInput);
        element.addEventListener("keydown", onEditableKeyDown);
      });
    }
    image.alt = title;
    addPhotoControlsForCard(card);
    added += 1;
  }

  showEditorStatus(`${added} ${added === 1 ? "photo" : "photos"} added to your portfolio and saved in this browser.`);
}

function addPhotoControlsForCard(card) {
  const image = card.querySelector("[data-editable-image]");
  if (!image || card.querySelector(".photo-editor-button")) {
    return;
  }
  card.classList.add("photo-editor-parent");
  const control = document.createElement("button");
  control.className = "photo-editor-button";
  control.type = "button";
  control.textContent = "REPLACE PHOTO";
  control.setAttribute("aria-label", `Replace ${image.alt || "portfolio"} photograph`);
  control.hidden = !isEditing;
  control.addEventListener("click", () => {
    activePhotoId = image.dataset.editableImage;
    uploadInput.multiple = false;
    uploadInput.click();
  });
  card.append(control);
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
    ".editor-toggle, .editor-panel, .photo-upload-input, .extra-photo-input, .photo-editor-button, .gallery-add, .link-manager",
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

function setLinkManagerStatus(message, isError = false) {
  linkManagerStatus.textContent = message;
  linkManagerStatus.classList.toggle("has-error", isError);
}

function normalizeLinkServiceUrl() {
  let serviceUrl;
  try {
    serviceUrl = new URL(linkServiceUrl.value.trim());
  } catch (error) {
    throw new Error("Enter the HTTPS address of your deployed link service.");
  }
  if (serviceUrl.protocol !== "https:" && serviceUrl.hostname !== "localhost") {
    throw new Error("The link service must use HTTPS.");
  }
  return serviceUrl.href.replace(/\/+$/, "");
}

function saveManagedLinkTokens() {
  try {
    localStorage.setItem("mara-portfolio-managed-link-tokens-v1", JSON.stringify([...managedLinkTokens]));
  } catch (error) {
    throw new Error("The link was created, but this browser could not save its management details.");
  }
}

async function linkServiceRequest(path, options = {}) {
  const serviceUrl = normalizeLinkServiceUrl();
  const adminSecret = linkAdminSecret.value.trim();
  if (!adminSecret) {
    throw new Error("Enter the admin secret you configured for your link service.");
  }
  try {
    localStorage.setItem(linkServiceStorageKey, serviceUrl);
  } catch (error) {
    throw new Error("The service URL could not be saved in this browser.");
  }

  const response = await fetch(`${serviceUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminSecret}`,
      ...options.headers,
    },
  });
  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error(`The link service returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(result.error || `The link service returned HTTP ${response.status}.`);
  }
  return { result, serviceUrl };
}

function restoreManagedLinkTokens() {
  try {
    const stored = JSON.parse(localStorage.getItem("mara-portfolio-managed-link-tokens-v1") || "[]");
    if (Array.isArray(stored)) {
      stored.forEach((entry) => {
        if (
          Array.isArray(entry) &&
          typeof entry[0] === "string" &&
          typeof entry[1] === "string"
        ) {
          managedLinkTokens.set(entry[0], entry[1]);
        }
      });
    }
    linkServiceUrl.value = localStorage.getItem(linkServiceStorageKey) || "";
  } catch (error) {
    setLinkManagerStatus("Could not load saved link settings from this browser.", true);
  }
}

function formatLinkDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown expiry";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderManagedLinks(links, serviceUrl) {
  linkList.replaceChildren();
  if (!links.length) {
    const empty = document.createElement("li");
    empty.className = "link-empty";
    empty.textContent = "No links yet. Create one above to get started.";
    linkList.append(empty);
    return;
  }

  links.forEach((item) => {
    const row = document.createElement("li");
    row.className = "managed-link";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `Created ${formatLinkDate(item.createdAt)}`;
    const expiry = document.createElement("span");
    expiry.textContent = item.revokedAt
      ? "Revoked"
      : `Expires ${formatLinkDate(item.expiresAt)}`;
    details.append(title, expiry);
    row.append(details);

    const token = managedLinkTokens.get(item.id);
    if (token && !item.revokedAt && new Date(item.expiresAt) > new Date()) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "COPY";
      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(`${serviceUrl}/s/${encodeURIComponent(token)}`);
          setLinkManagerStatus("Share link copied.");
        } catch (error) {
          setLinkManagerStatus("Could not copy the link. Check clipboard permissions.", true);
        }
      });
      row.append(copyButton);
    }

    if (!item.revokedAt && new Date(item.expiresAt) > new Date()) {
      const revokeButton = document.createElement("button");
      revokeButton.type = "button";
      revokeButton.textContent = "REVOKE";
      revokeButton.addEventListener("click", async () => {
        revokeButton.disabled = true;
        try {
          await linkServiceRequest(`/api/links/${encodeURIComponent(item.id)}`, { method: "DELETE" });
          setLinkManagerStatus("Link revoked. It will no longer open.");
          await refreshManagedLinks();
        } catch (error) {
          revokeButton.disabled = false;
          setLinkManagerStatus(error.message || "Could not revoke this link.", true);
        }
      });
      row.append(revokeButton);
    }
    linkList.append(row);
  });
}

async function refreshManagedLinks() {
  setLinkManagerStatus("Loading your links…");
  const { result, serviceUrl } = await linkServiceRequest("/api/links", { method: "GET" });
  if (!Array.isArray(result.links)) {
    throw new Error("The link service response did not include a link list.");
  }
  renderManagedLinks(result.links, serviceUrl);
  setLinkManagerStatus(`${result.links.length} ${result.links.length === 1 ? "link" : "links"} in your manager.`);
}

async function createManagedLink() {
  const expiryHours = Number(document.querySelector(".link-expiry").value);
  if (!Number.isInteger(expiryHours) || expiryHours < 1 || expiryHours > 8760) {
    setLinkManagerStatus("Choose an expiry between 1 hour and 1 year.", true);
    return;
  }

  const createButton = document.querySelector(".link-create");
  createButton.disabled = true;
  setLinkManagerStatus("Creating a new expiring link…");
  try {
    const { result } = await linkServiceRequest("/api/links", {
      method: "POST",
      body: JSON.stringify({ expiresInHours: expiryHours }),
    });
    if (
      typeof result.id !== "string" ||
      typeof result.token !== "string" ||
      typeof result.expiresAt !== "string"
    ) {
      throw new Error("The link service returned incomplete link details.");
    }
    managedLinkTokens.set(result.id, result.token);
    saveManagedLinkTokens();
    await refreshManagedLinks();
    setLinkManagerStatus(`Link created. It expires ${formatLinkDate(result.expiresAt)}.`);
  } catch (error) {
    setLinkManagerStatus(error.message || "Could not create a link.", true);
  } finally {
    createButton.disabled = false;
  }
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
        localStorage.removeItem(extraPhotosStorageKey);
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

const addPhotosButton = document.querySelector(".add-photos-button");
addPhotosButton.addEventListener("click", () => {
  if (!isEditing) {
    setEditing(true);
    showEditorStatus("Choose one or more photographs to add them to your collection.");
  }
  extraPhotoInput.click();
});

extraPhotoInput.addEventListener("change", async () => {
  const files = [...extraPhotoInput.files];
  extraPhotoInput.value = "";
  if (!files.length) {
    return;
  }
  try {
    await addMorePhotos(files);
  } catch (error) {
    showEditorStatus(error.message || "Could not add those photographs.", true);
  }
});

document.querySelector(".portfolio-grid").addEventListener("click", (event) => {
  const button = event.target.closest(".image-button");
  if (!button) {
    return;
  }
  if (isEditing && event.target.closest("[data-editable-text]")) {
    return;
  }
  lightboxImage.src = button.dataset.image;
  lightboxImage.alt = button.dataset.alt;
  lightboxCaption.textContent = button.dataset.caption;
  lightbox.showModal();
});

document.querySelector(".editor-links").addEventListener("click", async () => {
  editorPanel.hidden = true;
  if (!linkManager.open) {
    linkManager.showModal();
  }
  if (linkServiceUrl.value.trim() && linkAdminSecret.value.trim()) {
    try {
      await refreshManagedLinks();
    } catch (error) {
      setLinkManagerStatus(error.message || "Could not load your links.", true);
    }
  }
});

document.querySelector(".link-manager-close").addEventListener("click", () => linkManager.close());
linkManager.addEventListener("click", (event) => {
  if (event.target === linkManager) {
    linkManager.close();
  }
});
document.querySelector(".link-create").addEventListener("click", createManagedLink);
document.querySelector(".link-refresh").addEventListener("click", async () => {
  try {
    await refreshManagedLinks();
  } catch (error) {
    setLinkManagerStatus(error.message || "Could not refresh your links.", true);
  }
});
linkManager.addEventListener("close", () => {
  if (isEditing && !editorPanel.classList.contains("has-error")) {
    editorPanel.hidden = false;
  }
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

const extraPhotoEntries = readExtraPhotoEntries();
renderExtraPhotos(extraPhotoEntries);
readSavedText();
wrapEditableText();
document.querySelectorAll(".custom-work-card").forEach((card) => {
  const entryId = card.querySelector("[data-editable-image]").dataset.editableImage;
  const entry = extraPhotoEntries.find((photo) => photo.id === entryId);
  if (!entry) {
    return;
  }
  addCustomEditableText(card.querySelector("h3"), `photo-title-${entry.id}`, entry.title);
  addCustomEditableText(card.querySelector(".image-caption"), `photo-caption-${entry.id}`, entry.caption);
});
restoreContactDetails();
addPhotoControls();
restoreManagedLinkTokens();
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
