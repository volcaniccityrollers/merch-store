(function () {
  'use strict';

  var toastTimeout = null;

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

  function renderProductCard(product) {
    var card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-product-id', product.id);

    card.innerHTML =
      '<img src="' + product.image + '" alt="' + product.name + '">' +
      '<div class="card-body">' +
      '<div class="product-name">' + product.name + '</div>' +
      '<div class="product-description">' + product.description + '</div>' +
      '<div class="product-price">$' + product.price.toFixed(2) + ' NZD</div>' +
      '<button class="btn-primary add-to-cart">Add to Cart</button>' +
      '</div>';

    var addBtn = card.querySelector('.add-to-cart');
    addBtn.addEventListener('click', function () {
      window.cart.addItem(product);
      showToast(product.name + ' added to cart');
    });

    return card;
  }

  function loadProducts() {
    fetch('products.json')
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
        console.error('Failed to load products:', err);
      });
  }

  document.addEventListener('DOMContentLoaded', loadProducts);
})();
