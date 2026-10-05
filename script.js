// Configuration for your Google Sheet
const SHEET_ID = "1t9lA_XwcIGoI5ZH4bN4BB2hSz1rlLGiuY_85lSAaamg"; 
const SHEET_NAME = "Sheet1"; // Matches your tab name in Google Sheets
const API_URL = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

let allProducts = [];

// Render products into the grid
function renderProducts(products) {
  const loadingContainer = document.getElementById("loading");
  const grid = document.getElementById("product-grid");

  grid.innerHTML = "";

  if (!products || products.length === 0) {
    loadingContainer.style.display = "block";
    loadingContainer.querySelector("p").innerText = "🔍 No items found in the spreadsheet.";
    return;
  }

  loadingContainer.style.display = "none";

  products.forEach(product => {
    // Mapping spreadsheet columns to variables
    const imageUrl = product["Imagen"] || product.image_url || "";
    const title = product["Nombre"] || product.title || "Product";
    const price = product["Precio"] || product.price || "";
    const affiliateUrl = product["Enlace"] || product.affiliate_url || "#";
    const category = product["Categoria"] || product.category || "Accessories";
    const badge = product["Badge"] || product.badge || "";

    const card = document.createElement("article");
    card.className = "card";
    
    const titleText = title.toLowerCase();
    const tagText = category.toLowerCase();
    card.setAttribute("data-search", `${titleText} ${tagText}`);

    card.innerHTML = `
      <div class="card-image-wrapper">
        ${badge ? `<span class="badge">${badge}</span>` : ''}
        <img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="category">${category}</span>
          ${price ? `<span class="price">${price}</span>` : ''}
        </div>
        <h2 class="card-title">${title}</h2>
        <a href="${affiliateUrl}" target="_blank" rel="noopener sponsored" class="btn-temu">
          View Deal on Temu
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>
        </a>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Fetch data from Google Sheets API
async function loadProducts() {
  const loadingContainer = document.getElementById("loading");
  loadingContainer.style.display = "block";
  loadingContainer.querySelector("p").innerText = "Loading catalog...";

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Could not fetch data from API");
    
    allProducts = await response.json();
    renderProducts(allProducts);

  } catch (error) {
    console.error("Error connecting to Google Sheets:", error);
    loadingContainer.style.display = "block";
    loadingContainer.querySelector("p").innerText = "Error loading catalog. Make sure your Google Sheet is shared as 'Anyone with the link can view'.";
  }
}

// Real-time search filter
function filterProducts() {
  const input = document.getElementById('search-Input').value.toLowerCase().trim();
  const cards = document.querySelectorAll('.card');
  const clearBtn = document.getElementById('clearBtn');
  const loadingContainer = document.getElementById("loading");
  
  const searchWords = input.split(' ').filter(word => word.length > 0);
  let visibleCount = 0;

  if (clearBtn) {
    clearBtn.style.display = input.length > 0 ? 'block' : 'none';
  }

  cards.forEach(card => {
    const searchText = card.getAttribute('data-search') || '';
    const matchesAll = searchWords.every(word => searchText.includes(word));

    if (matchesAll) {
      card.style.display = 'flex';
      visibleCount++;
    } else {
      card.style.display = 'none';
    }
  });

  if (visibleCount === 0 && cards.length > 0) {
    loadingContainer.style.display = "block";
    loadingContainer.querySelector("p").innerText = "🔍 No items found matching your search.";
  } else {
    loadingContainer.style.display = "none";
  }
}

function clearSearch() {
  const searchInput = document.getElementById('search-Input');
  if (searchInput) {
    searchInput.value = '';
    filterProducts();
  }
}

// Automatically load data on page start
loadProducts();