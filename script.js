// =========================================================
// BUDGETBASE - catalog script
// Loads products from Google Sheets (English or Spanish tab),
// with category buttons, search and pagination.
// =========================================================

// ----- CONFIGURATION -----
const SHEET_ID = "1xxvg5UBodhCkLkFEZLhfcFdUihDANzXEya_4a0uWk2I";

// Name of each tab at the bottom of your Google Sheet.
// If you rename a tab (for example to "EN" and "ES"), change it here.
const SHEET_TABS = {
  en: "Sheet1",
  es: "Sheet2"
};

// How many products to show on each page
const PRODUCTS_PER_PAGE = 20;

// The language comes from <html lang="..."> in each page (en or es)
const LANG = (document.documentElement.lang || "en").toLowerCase().startsWith("es") ? "es" : "en";
const API_URL = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(SHEET_TABS[LANG])}`;

// ----- TEXTS -----
const TEXTS = {
  en: {
    viewDeal: "View Deal on Temu",
    loading: "Loading catalog...",
    empty: "No products available yet. Please check back soon.",
    noMatch: "🔍 No items found matching your search.",
    error: "We couldn't load the catalog. Please try again in a few minutes.",
    all: "All",
    other: "Other",
    prev: "‹ Prev",
    next: "Next ›",
    prevLabel: "Previous page",
    nextLabel: "Next page",
    pageLabel: (n) => `Page ${n}`,
    paginationLabel: "Pagination",
    categoriesLabel: "Product categories",
    noImage: "No image"
  },
  es: {
    viewDeal: "Ver oferta en Temu",
    loading: "Cargando catálogo...",
    empty: "Aún no hay productos disponibles. Vuelve pronto.",
    noMatch: "🔍 No se encontraron artículos que coincidan con tu búsqueda.",
    error: "No pudimos cargar el catálogo. Inténtalo de nuevo en unos minutos.",
    all: "Todos",
    other: "Otros",
    prev: "‹ Anterior",
    next: "Siguiente ›",
    prevLabel: "Página anterior",
    nextLabel: "Página siguiente",
    pageLabel: (n) => `Página ${n}`,
    paginationLabel: "Paginación",
    categoriesLabel: "Categorías de productos",
    noImage: "Sin imagen"
  }
};
const T = TEXTS[LANG];

// Accepted column names (in English or Spanish). Matching ignores
// capital letters, accents, spaces and symbols.
const COLUMN_ALIASES = {
  image: ["imageurl", "image", "imagen", "urlimagen", "urldeimagen", "foto"],
  title: ["name", "nombre", "title", "titulo", "producto", "product"],
  link: ["link", "enlace", "url", "affiliatelink", "enlacedeafiliado", "linkdeafiliado"],
  category: ["category", "categoria", "categorias"]
};

// ----- CATEGORIES -----
// These are the ONLY category buttons the site shows, in this order.
// "match" lists the words you may type in the CATEGORY column of the sheet
// (capital letters and accents don't matter). Both languages work in
// either tab. To add or remove a button, edit this list.
const CATEGORY_CONFIG = [
  {
    id: "home",
    label: { en: "Home & Kitchen", es: "Hogar y cocina" },
    match: ["home", "home & kitchen", "home and kitchen", "kitchen", "hogar", "hogar y cocina", "hogar & cocina", "cocina"]
  },
  {
    id: "gifts",
    label: { en: "Gifts", es: "Regalos" },
    match: ["gifts", "gift", "gift ideas", "regalos", "regalo", "ideas de regalo"]
  },
  {
    id: "fashion",
    label: { en: "Fashion & Accessories", es: "Moda y accesorios" },
    match: ["fashion", "fashion & accessories", "fashion and accessories", "accessories", "moda", "moda y accesorios", "moda & accesorios", "accesorios"]
  },
  {
    id: "beauty",
    label: { en: "Beauty Tools", es: "Belleza" },
    match: ["beauty", "beauty tools", "belleza", "herramientas de belleza"]
  },
  {
    id: "gaming",
    label: { en: "Gaming", es: "Gaming" },
    match: ["gaming", "games", "gamer", "gaming accessories", "videojuegos", "juegos"]
  }
];

// Lowercase, no accents, single spaces
function cleanCategory(text) {
  return normalizeText(text).replace(/\s+/g, " ").trim();
}

// Quick lookup: typed name -> category
const knownCategoryLookup = new Map();
CATEGORY_CONFIG.forEach(cat => {
  cat.match.forEach(name => knownCategoryLookup.set(cleanCategory(name), cat));
});

// Names found in the sheet that are not in CATEGORY_CONFIG
const unknownCategories = new Set();

// Turns the text from the sheet into a category id and a display label.
// Unknown categories get no button; those products only show under "All".
function resolveCategory(rawName) {
  const cat = knownCategoryLookup.get(cleanCategory(rawName));
  if (cat) return { id: cat.id, label: cat.label[LANG] };
  if (rawName) unknownCategories.add(rawName);
  return { id: "other", label: rawName ? formatLabel(rawName) : T.other };
}

// Gray placeholder shown when a product image fails to load
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#EEEAE1"/><text x="150" y="156" font-family="sans-serif" font-size="16" fill="#5E6860" text-anchor="middle">${T.noImage}</text></svg>`
  );

// ----- STATE -----
let allProducts = [];       // every product from the sheet
let filteredProducts = [];  // products matching the search and category
let categories = [];        // [{ key, label, count }]
let activeCategory = "all"; // "all" or a category key
let currentPage = 1;

// ----- HELPERS -----

// Lowercase and remove accents so "organizacion" finds "organización"
function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Prevents quotes or HTML in product names from breaking the page
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// "FASHION" -> "Fashion"
function formatLabel(text) {
  const clean = String(text).trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// Gets a value from a sheet row using the column name (any accepted name).
// If no column name matches, it falls back to the column position.
function getField(row, aliases, position) {
  const keys = Object.keys(row);
  for (const key of keys) {
    const normalizedKey = normalizeText(key).replace(/[^a-z0-9]/g, "");
    if (aliases.includes(normalizedKey)) {
      return String(row[key] || "").trim();
    }
  }
  const values = Object.values(row);
  return values[position] ? String(values[position]).trim() : "";
}

// Only allow normal web links
function safeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : "#";
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

// Keep category and page in the URL so they can be shared or refreshed
function updateUrl() {
  const url = new URL(window.location.href);
  if (activeCategory !== "all") {
    url.searchParams.set("cat", activeCategory);
  } else {
    url.searchParams.delete("cat");
  }
  if (currentPage > 1) {
    url.searchParams.set("page", currentPage);
  } else {
    url.searchParams.delete("page");
  }
  window.history.replaceState({}, "", url);
}

// Message box (loading, errors, no results)
function setMessage(text, showResetButton) {
  const box = document.getElementById("loading");
  box.style.display = "block";
  box.querySelector("p").innerText = text;
  const resetBtn = box.querySelector(".btn-reset");
  if (resetBtn) resetBtn.style.display = showResetButton ? "" : "none";
}

function hideMessage() {
  document.getElementById("loading").style.display = "none";
}

// Returns the pagination container, creating it under the grid if missing
function getPaginationContainer() {
  let nav = document.getElementById("pagination");
  if (!nav) {
    nav = document.createElement("nav");
    nav.id = "pagination";
    nav.className = "pagination";
    nav.setAttribute("aria-label", T.paginationLabel);
    document.getElementById("product-grid").insertAdjacentElement("afterend", nav);
  }
  return nav;
}

// Returns the category bar container, creating it above the grid if missing
function getCategoryBar() {
  let bar = document.getElementById("category-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "category-bar";
    bar.className = "category-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", T.categoriesLabel);
    document.getElementById("product-grid").insertAdjacentElement("beforebegin", bar);
  }
  return bar;
}

// ----- CATEGORIES -----

// Build the buttons from CATEGORY_CONFIG. A category with no products
// yet gets no button, so visitors never see an empty category.
function buildCategories() {
  categories = CATEGORY_CONFIG
    .map(cat => ({
      key: cat.id,
      label: cat.label[LANG],
      count: allProducts.filter(product => product.categoryKey === cat.id).length
    }))
    .filter(cat => cat.count > 0);
}

function renderCategoryBar() {
  const bar = getCategoryBar();
  bar.innerHTML = "";

  // Buttons are useless with only one category
  if (categories.length < 2) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "";

  const addButton = (key, label, count) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cat-btn" + (key === activeCategory ? " active" : "");
    btn.setAttribute("aria-pressed", key === activeCategory ? "true" : "false");
    btn.addEventListener("click", () => selectCategory(key));

    const text = document.createElement("span");
    text.textContent = label;
    const number = document.createElement("span");
    number.className = "cat-count";
    number.textContent = count;

    btn.appendChild(text);
    btn.appendChild(number);
    bar.appendChild(btn);
  };

  addButton("all", T.all, allProducts.length);
  categories.forEach(cat => addButton(cat.key, cat.label, cat.count));
}

function selectCategory(key) {
  activeCategory = key;
  applyFilters(false);
}

// ----- FILTERING -----

// Applies the search text and the selected category
function applyFilters(keepPage) {
  const searchInput = document.getElementById("search-Input");
  const query = searchInput ? normalizeText(searchInput.value).trim() : "";
  const words = query.split(" ").filter(word => word.length > 0);

  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) clearBtn.style.display = query.length > 0 ? "block" : "none";

  filteredProducts = allProducts.filter(product => {
    const matchesCategory = activeCategory === "all" || product.categoryKey === activeCategory;
    const matchesSearch = words.every(word => product.searchText.includes(word));
    return matchesCategory && matchesSearch;
  });

  if (!keepPage) currentPage = 1;

  renderCategoryBar();
  renderProducts();
}

// Called while typing in the search box
function filterProducts() {
  applyFilters(false);
}

// "Show all products" button and the × button
function clearSearch() {
  const searchInput = document.getElementById("search-Input");
  if (searchInput) searchInput.value = "";
  activeCategory = "all";
  applyFilters(false);
}

// ----- RENDERING -----

// Render ONLY the products of the current page into the grid
function renderProducts() {
  const grid = document.getElementById("product-grid");
  const pagination = getPaginationContainer();

  grid.innerHTML = "";

  if (filteredProducts.length === 0) {
    pagination.innerHTML = "";
    if (allProducts.length === 0) {
      setMessage(T.empty, false);
    } else {
      setMessage(T.noMatch, true);
    }
    updateUrl();
    return;
  }

  hideMessage();

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageProducts = filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);

  pageProducts.forEach(product => {
    const card = document.createElement("article");
    card.className = "card";

    const safeTitle = escapeHtml(product.title);
    const safeCategory = escapeHtml(product.categoryLabel);
    const safeImage = escapeHtml(product.imageUrl);
    const safeLink = escapeHtml(product.affiliateUrl);

    card.innerHTML = `
      <div class="card-image-wrapper">
        <img src="${safeImage}" alt="${safeTitle}" loading="lazy">
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="category">${safeCategory}</span>
        </div>
        <h2 class="card-title">${safeTitle}</h2>
        <a href="${safeLink}" target="_blank" rel="noopener sponsored" class="btn-temu">
          ${T.viewDeal}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>
        </a>
      </div>
    `;

    // If the image fails to load, show the placeholder (only once)
    const img = card.querySelector("img");
    img.addEventListener("error", () => {
      img.src = PLACEHOLDER_IMAGE;
    }, { once: true });

    grid.appendChild(card);
  });

  renderPagination(totalPages);
  updateUrl();
}

// Build the pagination buttons: Prev 1 2 3 ... 8 Next
function renderPagination(totalPages) {
  const nav = getPaginationContainer();
  nav.innerHTML = "";

  // No need for buttons if everything fits on one page
  if (totalPages <= 1) return;

  const addButton = (label, page, options = {}) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-btn" + (options.active ? " active" : "");
    btn.textContent = label;
    btn.disabled = !!options.disabled;
    if (options.active) btn.setAttribute("aria-current", "page");
    if (options.ariaLabel) btn.setAttribute("aria-label", options.ariaLabel);
    if (!options.disabled && !options.active) {
      btn.addEventListener("click", () => goToPage(page));
    }
    nav.appendChild(btn);
  };

  const addDots = () => {
    const dots = document.createElement("span");
    dots.className = "page-dots";
    dots.textContent = "…";
    nav.appendChild(dots);
  };

  addButton(T.prev, currentPage - 1, {
    disabled: currentPage === 1,
    ariaLabel: T.prevLabel
  });

  // Always show first, last, and 1 page around the current one
  for (let i = 1; i <= totalPages; i++) {
    const isEdge = i === 1 || i === totalPages;
    const isNearCurrent = Math.abs(i - currentPage) <= 1;

    if (isEdge || isNearCurrent) {
      addButton(String(i), i, {
        active: i === currentPage,
        ariaLabel: T.pageLabel(i)
      });
    } else if (i === 2 || i === totalPages - 1) {
      addDots();
    }
  }

  addButton(T.next, currentPage + 1, {
    disabled: currentPage === totalPages,
    ariaLabel: T.nextLabel
  });
}

// Change page and scroll back to the top of the catalog
function goToPage(page) {
  currentPage = page;
  renderProducts();

  const catalog = document.querySelector(".catalog-container");
  if (catalog) {
    catalog.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ----- DATA LOADING -----

async function loadProducts() {
  setMessage(T.loading, false);

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Could not fetch data from the API");

    const rows = await response.json();

    allProducts = rows
      .map(row => {
        const title = getField(row, COLUMN_ALIASES.title, 1);
        const categoryRaw = getField(row, COLUMN_ALIASES.category, 3);
        const category = resolveCategory(categoryRaw);
        return {
          imageUrl: getField(row, COLUMN_ALIASES.image, 0),
          title: title,
          affiliateUrl: safeUrl(getField(row, COLUMN_ALIASES.link, 2)),
          categoryKey: category.id,
          categoryLabel: category.label,
          searchText: normalizeText(`${title} ${category.label} ${categoryRaw}`)
        };
      })
      // Skip empty rows
      .filter(product => product.title && product.affiliateUrl !== "#")
      // Newest products (bottom of the sheet) first
      .reverse();

    // Helps you spot a category typed in the sheet that has no button
    if (unknownCategories.size > 0) {
      console.warn("Categories not in CATEGORY_CONFIG (shown only under 'All'):", Array.from(unknownCategories));
    }

    buildCategories();

    // Restore category and page from the URL (?cat=home&page=2)
    const params = getParams();
    const urlCategory = params.get("cat");
    if (urlCategory && categories.some(cat => cat.key === urlCategory)) {
      activeCategory = urlCategory;
    }
    const urlPage = parseInt(params.get("page"), 10);
    currentPage = urlPage > 0 ? urlPage : 1;

    applyFilters(true);

  } catch (error) {
    console.error("Error loading the Google Sheet:", error);
    setMessage(T.error, false);
  }
}

// Load data when the page starts
loadProducts();
