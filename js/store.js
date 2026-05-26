(function () {
  'use strict';

  var toastTimeout = null;
  var storeCurrency = 'NZD';

  function showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  }

  function getPrice(product) {
    return storeCurrency === 'AUD' ? product.priceAUD : product.priceNZD;
  }

  function renderProductCard(product) {
    var card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-product-id', product.id);

    var price = getPrice(product);

    if (product.image) {
      var img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name;
      card.appendChild(img);
    } else {
      var placeholder = document.createElement('div');
      placeholder.className = 'product-image-placeholder';
      card.appendChild(placeholder);
    }

    var body = document.createElement('div');
    body.className = 'card-body';

    var nameEl = document.createElement('div');
    nameEl.className = 'product-name';
    nameEl.textContent = product.name;
    body.appendChild(nameEl);

    var descEl = document.createElement('div');
    descEl.className = 'product-description';
    descEl.textContent = product.description;
    body.appendChild(descEl);

    var priceEl = document.createElement('div');
    priceEl.className = 'product-price';
    priceEl.textContent = '$' + price.toFixed(2) + ' ' + storeCurrency;
    body.appendChild(priceEl);

    var addBtn = document.createElement('button');
    addBtn.className = 'btn-primary add-to-cart';
    addBtn.textContent = 'Add to Cart';
    addBtn.addEventListener('click', function () {
      window.cart.addItem(product, storeCurrency);
      showToast(product.name + ' added to cart');
    });
    body.appendChild(addBtn);

    card.appendChild(body);
    return card;
  }

  var API_URL = 'https://australia-southeast1-vcr-tooling.cloudfunctions.net/merch-checkout';

  function loadStore() {
    var grid = document.getElementById('product-grid');
    if (!grid) return;

    var loading = document.createElement('div');
    loading.className = 'store-loading';
    loading.textContent = 'Loading merch...';
    grid.appendChild(loading);

    fetch(API_URL + '/config')
      .then(function (res) { return res.json(); })
      .then(function (config) {
        storeCurrency = config.currency || 'NZD';
        return fetch(API_URL + '/products');
      })
      .then(function (res) { return res.json(); })
      .then(function (products) {
        grid.removeChild(loading);

        var active = products.filter(function (p) { return p.active; });
        if (active.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'store-empty';
          empty.textContent = 'No products available right now.';
          grid.appendChild(empty);
          return;
        }

        active.forEach(function (product) {
          grid.appendChild(renderProductCard(product));
        });
      })
      .catch(function () {
        grid.removeChild(loading);
        var error = document.createElement('div');
        error.className = 'store-error';
        error.textContent = 'Failed to load products. Please refresh.';
        grid.appendChild(error);
      });
  }

  document.addEventListener('DOMContentLoaded', loadStore);
})();
