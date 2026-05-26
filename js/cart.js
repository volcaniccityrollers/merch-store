const CHECKOUT_URL = 'https://australia-southeast1-vcr-tooling.cloudfunctions.net/merch-checkout';

(function () {
  'use strict';

  var STORAGE_KEY = 'vcr_cart';

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateBadge();
    renderCartDrawer();
  }

  function addItem(product) {
    var cart = getCart();
    var existing = cart.find(function (item) {
      return item.id === product.id;
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image
      });
    }

    saveCart(cart);
  }

  function removeItem(productId) {
    var cart = getCart().filter(function (item) {
      return item.id !== productId;
    });
    saveCart(cart);
  }

  function updateQuantity(productId, quantity) {
    var cart = getCart();
    var item = cart.find(function (i) {
      return i.id === productId;
    });

    if (item) {
      if (quantity <= 0) {
        removeItem(productId);
        return;
      }
      item.quantity = quantity;
      saveCart(cart);
    }
  }

  function getTotal() {
    return getCart().reduce(function (sum, item) {
      return sum + item.price * item.quantity;
    }, 0);
  }

  function getItemCount() {
    return getCart().reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
  }

  function clearCart() {
    localStorage.removeItem(STORAGE_KEY);
    updateBadge();
    renderCartDrawer();
  }

  // UI Functions
  function updateBadge() {
    var badge = document.getElementById('cart-badge');
    if (!badge) return;
    var count = getItemCount();
    badge.textContent = count;
    if (count > 0) {
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  function createCartItemElement(item) {
    var row = document.createElement('div');
    row.className = 'cart-item';

    if (item.image) {
      var img = document.createElement('img');
      img.src = item.image;
      img.alt = item.name;
      row.appendChild(img);
    }

    var details = document.createElement('div');
    details.className = 'cart-item-details';

    var nameEl = document.createElement('div');
    nameEl.className = 'cart-item-name';
    nameEl.textContent = item.name;
    details.appendChild(nameEl);

    var priceEl = document.createElement('div');
    priceEl.className = 'cart-item-price';
    priceEl.textContent = '$' + item.price.toFixed(2);
    details.appendChild(priceEl);

    var qtyRow = document.createElement('div');
    qtyRow.className = 'cart-item-qty';

    var decreaseBtn = document.createElement('button');
    decreaseBtn.textContent = '-';
    decreaseBtn.setAttribute('data-action', 'decrease');
    decreaseBtn.setAttribute('data-id', item.id);
    qtyRow.appendChild(decreaseBtn);

    var qtySpan = document.createElement('span');
    qtySpan.textContent = item.quantity;
    qtyRow.appendChild(qtySpan);

    var increaseBtn = document.createElement('button');
    increaseBtn.textContent = '+';
    increaseBtn.setAttribute('data-action', 'increase');
    increaseBtn.setAttribute('data-id', item.id);
    qtyRow.appendChild(increaseBtn);

    details.appendChild(qtyRow);
    row.appendChild(details);

    var removeBtn = document.createElement('button');
    removeBtn.className = 'cart-item-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.setAttribute('data-action', 'remove');
    removeBtn.setAttribute('data-id', item.id);
    row.appendChild(removeBtn);

    return row;
  }

  function renderCartDrawer() {
    var container = document.getElementById('cart-items');
    var totalEl = document.getElementById('cart-total');
    if (!container || !totalEl) return;

    var cart = getCart();

    // Clear existing content
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (cart.length === 0) {
      var emptyMsg = document.createElement('div');
      emptyMsg.className = 'cart-empty';
      emptyMsg.textContent = 'Your cart is empty';
      container.appendChild(emptyMsg);
      totalEl.textContent = '$0.00 NZD';
      return;
    }

    cart.forEach(function (item) {
      container.appendChild(createCartItemElement(item));
    });

    totalEl.textContent = '$' + getTotal().toFixed(2) + ' NZD';
  }

  function toggleDrawer(open) {
    var drawer = document.getElementById('cart-drawer');
    var overlay = document.getElementById('cart-overlay');
    if (!drawer || !overlay) return;

    if (open) {
      drawer.classList.add('open');
      overlay.classList.add('open');
      document.body.classList.add('cart-open');
    } else {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      document.body.classList.remove('cart-open');
    }
  }

  function handleCheckout() {
    var cart = getCart();
    if (cart.length === 0) return;

    fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.url) {
          clearCart();
          window.location.href = data.url;
        }
      })
      .catch(function (err) {
        console.error('Checkout error:', err);
      });
  }

  // Event Listeners
  document.addEventListener('DOMContentLoaded', function () {
    updateBadge();
    renderCartDrawer();

    var toggleBtn = document.getElementById('cart-toggle');
    var closeBtn = document.getElementById('cart-close');
    var overlay = document.getElementById('cart-overlay');
    var checkoutBtn = document.getElementById('checkout-btn');
    var cartItemsEl = document.getElementById('cart-items');

    if (toggleBtn) toggleBtn.addEventListener('click', function () { toggleDrawer(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { toggleDrawer(false); });
    if (overlay) overlay.addEventListener('click', function () { toggleDrawer(false); });
    if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);

    if (cartItemsEl) {
      cartItemsEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');

        if (action === 'remove') {
          removeItem(id);
        } else if (action === 'decrease') {
          var cart = getCart();
          var found = cart.find(function (i) { return i.id === id; });
          if (found) updateQuantity(id, found.quantity - 1);
        } else if (action === 'increase') {
          var cart = getCart();
          var found = cart.find(function (i) { return i.id === id; });
          if (found) updateQuantity(id, found.quantity + 1);
        }
      });
    }
  });

  // Expose API
  window.cart = {
    addItem: addItem,
    removeItem: removeItem,
    updateQuantity: updateQuantity,
    getCart: getCart,
    getTotal: getTotal,
    getItemCount: getItemCount,
    clearCart: clearCart,
    toggleDrawer: toggleDrawer
  };
})();
