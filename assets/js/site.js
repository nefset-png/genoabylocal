(function () {
  function getContactDrop() {
    return document.getElementById('contact-drop');
  }

  window.toggleContact = function toggleContact(event) {
    if (event) event.stopPropagation();
    var dropdown = getContactDrop();
    if (!dropdown) return;
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  };

  document.addEventListener('click', function () {
    var dropdown = getContactDrop();
    if (dropdown) dropdown.style.display = 'none';
  });
}());
