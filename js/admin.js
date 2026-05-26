const ADMIN_URL = 'https://australia-southeast1-vcr-tooling.cloudfunctions.net/merch-checkout';

// DOM elements
const passcodeGate = document.getElementById('passcodeGate');
const passcodeForm = document.getElementById('passcodeForm');
const passcodeInput = document.getElementById('passcodeInput');
const passcodeError = document.getElementById('passcodeError');
const adminPanel = document.getElementById('adminPanel');
const productListContainer = document.getElementById('productListContainer');
const addProductForm = document.getElementById('addProductForm');
const addProductBtn = document.getElementById('addProductBtn');
const addProductError = document.getElementById('addProductError');
const addProductSuccess = document.getElementById('addProductSuccess');

// Check if already authenticated
function init() {
  const stored = sessionStorage.getItem('adminPasscode');
  if (stored) {
    showAdminPanel();
  }
}

// Passcode submission
passcodeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passcodeError.style.display = 'none';

  const passcode = passcodeInput.value.trim();
  if (!passcode) return;

  try {
    const res = await fetch(ADMIN_URL + '/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });

    if (res.ok) {
      sessionStorage.setItem('adminPasscode', passcode);
      showAdminPanel();
    } else {
      passcodeError.style.display = 'block';
    }
  } catch (err) {
    passcodeError.textContent = 'Connection error. Try again.';
    passcodeError.style.display = 'block';
  }
});

function showAdminPanel() {
  passcodeGate.style.display = 'none';
  adminPanel.style.display = 'block';
  loadProducts();
}

// Load and render products
async function loadProducts() {
  productListContainer.textContent = '';
  const loadingEl = document.createElement('p');
  loadingEl.className = 'loading';
  loadingEl.textContent = 'Loading products...';
  productListContainer.appendChild(loadingEl);

  try {
    const res = await fetch('products.json?t=' + Date.now());
    if (!res.ok) throw new Error('Failed to fetch products');
    const products = await res.json();
    renderProducts(products);
  } catch (err) {
    productListContainer.textContent = '';
    const errEl = document.createElement('p');
    errEl.className = 'error-message';
    errEl.textContent = err.message;
    productListContainer.appendChild(errEl);
  }
}

function renderProducts(products) {
  productListContainer.textContent = '';

  if (!products.length) {
    const emptyEl = document.createElement('p');
    emptyEl.textContent = 'No products found.';
    productListContainer.appendChild(emptyEl);
    return;
  }

  products.forEach((product) => {
    const item = document.createElement('div');
    item.className = 'product-item';

    const img = document.createElement('img');
    img.src = product.image;
    img.alt = product.name;
    item.appendChild(img);

    const info = document.createElement('div');
    info.className = 'product-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = product.name;
    info.appendChild(nameEl);

    const priceEl = document.createElement('div');
    priceEl.className = 'price';
    priceEl.textContent = '$' + Number(product.price).toFixed(2);
    info.appendChild(priceEl);

    item.appendChild(info);

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = product.active;
    checkbox.dataset.id = product.id;
    checkbox.addEventListener('change', () => {
      handleToggle(product.id, checkbox.checked);
    });

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(slider);
    item.appendChild(toggleLabel);

    productListContainer.appendChild(item);
  });
}

// Toggle product active state
async function handleToggle(productId, active) {
  const passcode = sessionStorage.getItem('adminPasscode');

  try {
    const res = await fetch(ADMIN_URL + '/products/' + productId, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Passcode': passcode
      },
      body: JSON.stringify({ active })
    });

    if (!res.ok) throw new Error('Failed to update product');
    await loadProducts();
  } catch (err) {
    alert('Error toggling product: ' + err.message);
    await loadProducts();
  }
}

// Add product form
addProductForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  addProductError.textContent = '';
  addProductSuccess.textContent = '';

  const name = document.getElementById('productName').value.trim();
  const price = parseFloat(document.getElementById('productPrice').value);
  const description = document.getElementById('productDescription').value.trim();
  const image = document.getElementById('productImage').value.trim();

  if (!name || isNaN(price) || !description || !image) {
    addProductError.textContent = 'Please fill in all required fields.';
    return;
  }

  const productData = { name, price, description, image, active: true };

  const passcode = sessionStorage.getItem('adminPasscode');
  addProductBtn.disabled = true;
  addProductBtn.textContent = 'Adding...';

  try {
    const res = await fetch(ADMIN_URL + '/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Passcode': passcode
      },
      body: JSON.stringify(productData)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to add product');
    }

    addProductSuccess.textContent = 'Product added successfully.';
    addProductForm.reset();
    await loadProducts();
  } catch (err) {
    addProductError.textContent = err.message;
  } finally {
    addProductBtn.disabled = false;
    addProductBtn.textContent = 'Add Product';
  }
});

// Initialize
init();
