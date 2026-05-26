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
    var imageHtml = product.image
      ? '<img src="' + product.image + '" alt="' + product.name + '">'
      : '<div class="product-image-placeholder"></div>';

    card.innerHTML =
      imageHtml +
      '<div class="card-body">' +
      '<div class="product-name">' + product.name + '</div>' +
      '<div class="product-description">' + product.description + '</div>' +
      '<div class="product-price">$' + price.toFixed(2) + ' ' + storeCurrency + '</div>' +
      '<button class="btn-primary add-to-cart">Add to Cart</button>' +
      '</div>';

    var addBtn = card.querySelector('.add-to-cart');
    addBtn.addEventListener('click', function () {
      window.cart.addItem(product, storeCurrency);
      showToast(product.name + ' added to cart');
    });

    return card;
  }

  var API_URL = 'https://australia-southeast1-vcr-tooling.cloudfunctions.net/merch-checkout';

  function loadStore() {
    fetch(API_URL + '/config')
      .then(function (res) { return res.json(); })
      .then(function (config) {
        storeCurrency = config.currency || 'NZD';
        return fetch(API_URL + '/products');
      })
      .then(function (res) { return res.json(); })
      .then(function (products) {
        var grid = document.getElementById('product-grid');
        if (!grid) return;

        products
          .filter(function (p) { return p.active; })
          .forEach(function (product) {
            grid.appendChild(renderProductCard(product));
          });
      })
      .catch(function (err) {
        console.error('Failed to load store:', err);
      });
  }

  document.addEventListener('DOMContentLoaded', loadStore);
})();
