const ADMIN_URL = 'https://australia-southeast1-vcr-tooling.cloudfunctions.net/merch-checkout';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Strip the data:image/...;base64, prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
const btnNZD = document.getElementById('btnNZD');
const btnAUD = document.getElementById('btnAUD');
const currencyStatus = document.getElementById('currencyStatus');

function init() {
  const stored = sessionStorage.getItem('adminPasscode');
  if (stored) {
    showAdminPanel();
  }
}

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
  loadConfig();
  loadProducts();
}

// Currency toggle
async function loadConfig() {
  try {
    const res = await fetch(ADMIN_URL + '/config');
    const config = await res.json();
    updateCurrencyUI(config.currency || 'NZD');
  } catch (err) {
    updateCurrencyUI('NZD');
  }
}

function updateCurrencyUI(currency) {
  btnNZD.classList.toggle('active', currency === 'NZD');
  btnAUD.classList.toggle('active', currency === 'AUD');
  currencyStatus.textContent = 'Store is showing ' + currency + ' prices';
}

btnNZD.addEventListener('click', () => setCurrency('NZD'));
btnAUD.addEventListener('click', () => setCurrency('AUD'));

async function setCurrency(currency) {
  const passcode = sessionStorage.getItem('adminPasscode');
  btnNZD.disabled = true;
  btnAUD.disabled = true;

  try {
    const res = await fetch(ADMIN_URL + '/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Passcode': passcode
      },
      body: JSON.stringify({ currency })
    });

    if (!res.ok) throw new Error('Failed to update currency');
    updateCurrencyUI(currency);
  } catch (err) {
    alert('Error updating currency: ' + err.message);
  } finally {
    btnNZD.disabled = false;
    btnAUD.disabled = false;
  }
}

// Load and render products
async function loadProducts() {
  productListContainer.textContent = '';
  const loadingEl = document.createElement('p');
  loadingEl.className = 'loading';
  loadingEl.textContent = 'Loading products...';
  productListContainer.appendChild(loadingEl);

  try {
    const res = await fetch(ADMIN_URL + '/products');
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

    if (product.image) {
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name;
      item.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'product-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = product.name;
    info.appendChild(nameEl);

    const priceEl = document.createElement('div');
    priceEl.className = 'price';
    priceEl.textContent = '$' + Number(product.priceNZD).toFixed(2) + ' NZD / $' + Number(product.priceAUD).toFixed(2) + ' AUD';
    info.appendChild(priceEl);

    item.appendChild(info);

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => showEditForm(product));
    item.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'edit-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.borderColor = '#EC2026';
    deleteBtn.style.color = '#EC2026';
    deleteBtn.addEventListener('click', () => handleDelete(product));
    item.appendChild(deleteBtn);

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

// Edit product
function createInput(type, className, value) {
  const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.className = className;
  input.value = value;
  if (type === 'number') { input.step = '0.01'; input.min = '0'; }
  return input;
}

function createFormGroup(labelText, inputEl) {
  const group = document.createElement('div');
  group.className = 'form-group';
  const label = document.createElement('label');
  label.textContent = labelText;
  group.appendChild(label);
  group.appendChild(inputEl);
  return group;
}

function showEditForm(product) {
  const existing = document.querySelector('.product-edit-form');
  if (existing) existing.remove();

  const form = document.createElement('div');
  form.className = 'product-edit-form';

  const nameInput = createInput('text', 'edit-name', product.name);
  form.appendChild(createFormGroup('Name', nameInput));

  const priceRow = document.createElement('div');
  priceRow.className = 'form-row';
  const nzdInput = createInput('number', 'edit-priceNZD', product.priceNZD);
  const audInput = createInput('number', 'edit-priceAUD', product.priceAUD);
  priceRow.appendChild(createFormGroup('Price NZD ($)', nzdInput));
  priceRow.appendChild(createFormGroup('Price AUD ($)', audInput));
  form.appendChild(priceRow);

  const descInput = createInput('textarea', 'edit-description', product.description);
  form.appendChild(createFormGroup('Description', descInput));

  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(actions);

  const errorEl = document.createElement('p');
  errorEl.className = 'error-message edit-error';
  form.appendChild(errorEl);

  // Insert after the product item
  const items = productListContainer.querySelectorAll('.product-item');
  let targetItem = null;
  items.forEach((item) => {
    const nameEl = item.querySelector('.name');
    if (nameEl && nameEl.textContent === product.name) targetItem = item;
  });

  if (targetItem) {
    targetItem.after(form);
  } else {
    productListContainer.appendChild(form);
  }

  saveBtn.addEventListener('click', () => handleEdit(product.id, form));
  cancelBtn.addEventListener('click', () => form.remove());
}

async function handleEdit(productId, form) {
  const passcode = sessionStorage.getItem('adminPasscode');
  const errorEl = form.querySelector('.edit-error');
  const saveBtn = form.querySelector('.save-btn');
  errorEl.textContent = '';

  const name = form.querySelector('.edit-name').value.trim();
  const priceNZD = parseFloat(form.querySelector('.edit-priceNZD').value);
  const priceAUD = parseFloat(form.querySelector('.edit-priceAUD').value);
  const description = form.querySelector('.edit-description').value.trim();

  if (!name || isNaN(priceNZD) || isNaN(priceAUD)) {
    errorEl.textContent = 'Name and prices are required.';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const res = await fetch(ADMIN_URL + '/products/' + productId, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Passcode': passcode
      },
      body: JSON.stringify({ name, priceNZD, priceAUD, description })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update product');
    }

    await loadProducts();
  } catch (err) {
    errorEl.textContent = err.message;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
  }
}

// Delete product
async function handleDelete(product) {
  if (!confirm('Delete "' + product.name + '"? This cannot be undone.')) return;

  const passcode = sessionStorage.getItem('adminPasscode');

  try {
    const res = await fetch(ADMIN_URL + '/products/' + product.id, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Passcode': passcode
      }
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete product');
    }

    await loadProducts();
  } catch (err) {
    alert('Error deleting product: ' + err.message);
  }
}

// Add product form
addProductForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  addProductError.textContent = '';
  addProductSuccess.textContent = '';

  const name = document.getElementById('productName').value.trim();
  const priceNZD = parseFloat(document.getElementById('productPriceNZD').value);
  const priceAUD = parseFloat(document.getElementById('productPriceAUD').value);
  const description = document.getElementById('productDescription').value.trim();
  const imageInput = document.getElementById('productImage');

  if (!name || isNaN(priceNZD) || isNaN(priceAUD) || !description) {
    addProductError.textContent = 'Please fill in all required fields.';
    return;
  }

  const passcode = sessionStorage.getItem('adminPasscode');
  addProductBtn.disabled = true;
  addProductBtn.textContent = 'Adding...';

  let imageUrl = '';

  // Upload image if one was selected
  if (imageInput.files && imageInput.files[0]) {
    const file = imageInput.files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.' + ext;

    try {
      const base64 = await fileToBase64(file);
      const uploadRes = await fetch(ADMIN_URL + '/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Passcode': passcode
        },
        body: JSON.stringify({
          filename: filename,
          data: base64,
          contentType: file.type
        })
      });

      if (!uploadRes.ok) throw new Error('Failed to upload image');
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.url;
    } catch (err) {
      addProductError.textContent = 'Image upload failed: ' + err.message;
      addProductBtn.disabled = false;
      addProductBtn.textContent = 'Add Product';
      return;
    }
  }

  const productData = { name, priceNZD, priceAUD, description, image: imageUrl, active: true };

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

init();
