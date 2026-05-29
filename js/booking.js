(function () {
  var EXPERIENCES = {
    genoa: {
      name: 'Genoa Must-Sees & Tastings',
      shortName: 'Genoa private walk',
      base: 240,
      extra: 30,
      duration: '3 hours',
      meeting: 'Meeting point in Genoa',
      note: 'Final payment on the day: cash or card.',
    },
    portofino: {
      name: 'Portofino & Beyond',
      shortName: 'Portofino full-day experience',
      base: 650,
      extra: 100,
      duration: 'Full day',
      meeting: 'Meeting at Porto Antico',
      note: 'Ferry tickets are included. Lunch can be arranged separately.',
    },
    'cinque-terre': {
      name: 'Cinque Terre Day Experience',
      shortName: 'Cinque Terre full-day experience',
      base: 650,
      extra: 130,
      duration: 'Full day',
      meeting: 'Meeting at Genova Brignole',
      note: 'Train tickets and add-ons can be agreed after booking.',
    },
  };

  var DEPOSIT = 100;

  function formatEUR(value) {
    return '€' + Number(value).toLocaleString('en-GB');
  }

  function todayISO() {
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  }

  function calculatePrice(experience, guests) {
    var data = EXPERIENCES[experience];
    if (!data) return 0;
    if (guests <= 4) return data.base;
    return data.base + (guests - 4) * data.extra;
  }

  function injectStyles() {
    if (document.getElementById('booking-widget-styles')) return;
    var style = document.createElement('style');
    style.id = 'booking-widget-styles';
    style.textContent = [
      '.booking-widget{background:#fff;border:0.5px solid #ece6dd;border-radius:12px;padding:28px;box-shadow:0 8px 32px rgba(35,22,10,0.08);color:#17120c}',
      '.booking-card.booking-widget{position:sticky;top:120px}',
      '.booking-widget-mobile{display:none;margin:34px 0 4px}',
      '.bw-kicker{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#d4a853;margin-bottom:10px}',
      '.bw-title{font-family:Georgia,serif;font-size:24px;font-weight:400;line-height:1.18;color:#1a3a2a;margin-bottom:6px}',
      '.bw-sub{font-size:12px;color:#7a7268;line-height:1.6;margin-bottom:22px}',
      '.bw-step{border-top:0.5px solid #ece6dd;padding-top:18px;margin-top:18px}',
      '.bw-label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#1a3a2a;font-weight:700;margin-bottom:10px}',
      '.bw-label span{font-size:11px;letter-spacing:0;text-transform:none;color:#a09890;font-weight:400}',
      '.bw-input,.bw-select{width:100%;border:0.5px solid #ece6dd;border-radius:7px;background:#fff;color:#17120c;font-size:14px;padding:13px 14px;outline:none;transition:border-color .2s,box-shadow .2s}',
      '.bw-input:focus,.bw-select:focus{border-color:#d4a853;box-shadow:0 0 0 3px rgba(212,168,83,.14)}',
      '.bw-slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
      '.bw-slot{border:1px solid #ece6dd;background:#f8f4ee;color:#1a3a2a;border-radius:7px;padding:12px 8px;font-size:12px;font-weight:700;cursor:pointer;transition:background .2s,border-color .2s,color .2s}',
      '.bw-slot:hover{border-color:#d4a853}',
      '.bw-slot.is-selected{background:#1a3a2a;border-color:#1a3a2a;color:#fff}',
      '.bw-slot:disabled{opacity:.45;cursor:not-allowed}',
      '.bw-status{font-size:12px;color:#7a7268;line-height:1.55;margin-top:10px}',
      '.bw-error{color:#9f3a28}',
      '.bw-price-box{background:#f8f4ee;border:0.5px solid #ece6dd;border-radius:8px;padding:16px;margin-top:12px}',
      '.bw-price-row{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:13px;color:#7a7268;margin-bottom:8px}',
      '.bw-price-row:last-child{margin-bottom:0;padding-top:10px;border-top:0.5px solid #e2d8ca;color:#1a3a2a;font-weight:700}',
      '.bw-total{font-family:Georgia,serif;font-size:24px;color:#1a3a2a}',
      '.bw-fields{display:grid;gap:10px}',
      '.bw-summary{font-size:13px;color:#3d3025;line-height:1.7;background:#fbf8f3;border:0.5px solid #ece6dd;border-radius:8px;padding:14px;margin-bottom:14px}',
      '.bw-submit{width:100%;border:none;border-radius:7px;background:#d4a853;color:#fff;padding:15px 16px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;cursor:pointer;transition:background .2s,transform .15s}',
      '.bw-submit:hover{background:#c49a45;transform:translateY(-1px)}',
      '.bw-submit:disabled{opacity:.55;cursor:not-allowed;transform:none}',
      '.bw-footnote{font-size:11px;color:#a09890;text-align:center;line-height:1.5;margin-top:12px}',
      '@media(max-width:900px){.booking-widget-mobile{display:block}.booking-card.booking-widget{position:static}.bw-slots{grid-template-columns:1fr 1fr}.booking-widget{padding:24px 20px}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderWidget(root) {
    var experience = root.getAttribute('data-experience');
    var data = EXPERIENCES[experience];
    if (!data) return;
    root.classList.add('booking-widget');
    root.innerHTML = [
      '<div class="bw-kicker">Book this experience</div>',
      '<h3 class="bw-title">' + data.name + '</h3>',
      '<p class="bw-sub">' + data.duration + ' · private tour · reserve with a ' + formatEUR(DEPOSIT) + ' deposit.</p>',
      '<form class="bw-form" novalidate>',
        '<div class="bw-step">',
          '<label class="bw-label">1. Choose a date <span>No past dates</span></label>',
          '<input class="bw-input" name="date" type="date" required>',
          '<div class="bw-status" data-role="date-status">Select a date to see live availability.</div>',
        '</div>',
        '<div class="bw-step">',
          '<div class="bw-label">2. Select a time <span>Available slots only</span></div>',
          '<div class="bw-slots" data-role="slots"><button class="bw-slot" type="button" disabled>Choose date first</button></div>',
        '</div>',
        '<div class="bw-step">',
          '<label class="bw-label">3. Guests <span>1-12 people</span></label>',
          '<select class="bw-select" name="guestCount"></select>',
          '<div class="bw-price-box">',
            '<div class="bw-price-row"><span>Total price</span><strong class="bw-total" data-role="total"></strong></div>',
            '<div class="bw-price-row"><span>Deposit due today</span><strong>' + formatEUR(DEPOSIT) + '</strong></div>',
            '<div class="bw-price-row"><span>Remaining on the day</span><strong data-role="remaining"></strong></div>',
          '</div>',
        '</div>',
        '<div class="bw-step">',
          '<div class="bw-label">4. Your details</div>',
          '<div class="bw-fields">',
            '<input class="bw-input" name="customerName" type="text" placeholder="Full name" autocomplete="name" required>',
            '<input class="bw-input" name="customerEmail" type="email" placeholder="Email" autocomplete="email" required>',
            '<input class="bw-input" name="customerPhone" type="tel" placeholder="Phone / WhatsApp" autocomplete="tel">',
          '</div>',
        '</div>',
        '<div class="bw-step">',
          '<div class="bw-label">5. Summary</div>',
          '<div class="bw-summary" data-role="summary"></div>',
          '<button class="bw-submit" type="submit">Pay ' + formatEUR(DEPOSIT) + ' deposit</button>',
          '<div class="bw-status" data-role="submit-status"></div>',
          '<div class="bw-footnote">' + data.note + '</div>',
        '</div>',
      '</form>',
    ].join('');
    bindWidget(root, experience, data);
  }

  function bindWidget(root, experience, data) {
    var form = root.querySelector('.bw-form');
    var dateInput = form.elements.date;
    var guestSelect = form.elements.guestCount;
    var slotsEl = root.querySelector('[data-role="slots"]');
    var dateStatus = root.querySelector('[data-role="date-status"]');
    var submitStatus = root.querySelector('[data-role="submit-status"]');
    var totalEl = root.querySelector('[data-role="total"]');
    var remainingEl = root.querySelector('[data-role="remaining"]');
    var summaryEl = root.querySelector('[data-role="summary"]');
    var submitBtn = root.querySelector('.bw-submit');
    var selectedTime = '';

    dateInput.min = todayISO();
    for (var i = 1; i <= 12; i += 1) {
      var option = document.createElement('option');
      option.value = String(i);
      option.textContent = i + (i === 1 ? ' guest' : ' guests');
      guestSelect.appendChild(option);
    }
    guestSelect.value = '4';

    function updatePriceAndSummary() {
      var guests = Number(guestSelect.value);
      var total = calculatePrice(experience, guests);
      totalEl.textContent = formatEUR(total);
      remainingEl.textContent = formatEUR(total - DEPOSIT);
      summaryEl.innerHTML = [
        '<strong>' + data.shortName + '</strong><br>',
        dateInput.value ? 'Date: ' + dateInput.value + '<br>' : 'Date: not selected<br>',
        selectedTime ? 'Time: ' + selectedTime + '<br>' : 'Time: not selected<br>',
        'Guests: ' + guests + '<br>',
        'Total: ' + formatEUR(total) + ' · Deposit today: ' + formatEUR(DEPOSIT),
      ].join('');
    }

    function setSlotsLoading() {
      selectedTime = '';
      slotsEl.innerHTML = '<button class="bw-slot" type="button" disabled>Checking...</button>';
      updatePriceAndSummary();
    }

    function renderSlots(slots) {
      selectedTime = '';
      slotsEl.innerHTML = '';
      if (!slots || slots.length === 0) {
        slotsEl.innerHTML = '<button class="bw-slot" type="button" disabled>No slots available</button>';
        dateStatus.textContent = 'No available times for this date. Please try another day.';
        return;
      }
      dateStatus.textContent = 'Choose one of the available times below.';
      slots.forEach(function (slot) {
        var button = document.createElement('button');
        button.className = 'bw-slot';
        button.type = 'button';
        button.textContent = slot;
        button.addEventListener('click', function () {
          selectedTime = slot;
          slotsEl.querySelectorAll('.bw-slot').forEach(function (item) {
            item.classList.remove('is-selected');
          });
          button.classList.add('is-selected');
          updatePriceAndSummary();
        });
        slotsEl.appendChild(button);
      });
      updatePriceAndSummary();
    }

    dateInput.addEventListener('change', function () {
      if (!dateInput.value) return;
      setSlotsLoading();
      dateStatus.classList.remove('bw-error');
      fetch('/.netlify/functions/check-availability?date=' + encodeURIComponent(dateInput.value) + '&experience=' + encodeURIComponent(experience))
        .then(function (res) { return res.json(); })
        .then(function (payload) {
          if (payload.error) throw new Error(payload.error);
          renderSlots(payload.slots || []);
        })
        .catch(function () {
          selectedTime = '';
          slotsEl.innerHTML = '<button class="bw-slot" type="button" disabled>Unable to load</button>';
          dateStatus.textContent = 'Availability could not be loaded. Please try again or contact me on WhatsApp.';
          dateStatus.classList.add('bw-error');
          updatePriceAndSummary();
        });
    });

    guestSelect.addEventListener('change', updatePriceAndSummary);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitStatus.textContent = '';
      submitStatus.classList.remove('bw-error');

      if (!dateInput.value || !selectedTime) {
        submitStatus.textContent = 'Please choose a date and available time first.';
        submitStatus.classList.add('bw-error');
        return;
      }
      if (!form.elements.customerName.value.trim() || !form.elements.customerEmail.value.trim()) {
        submitStatus.textContent = 'Please enter your name and email.';
        submitStatus.classList.add('bw-error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Opening checkout...';

      fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience: experience,
          date: dateInput.value,
          time: selectedTime,
          guestCount: Number(guestSelect.value),
          customerName: form.elements.customerName.value.trim(),
          customerEmail: form.elements.customerEmail.value.trim(),
          customerPhone: form.elements.customerPhone.value.trim(),
        }),
      })
        .then(function (res) { return res.json(); })
        .then(function (payload) {
          if (!payload.success || !payload.checkoutUrl) {
            throw new Error(payload.error || 'Checkout could not be created');
          }
          window.location.href = payload.checkoutUrl;
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Pay ' + formatEUR(DEPOSIT) + ' deposit';
          submitStatus.textContent = 'Checkout could not be opened. Please try again or contact me on WhatsApp.';
          submitStatus.classList.add('bw-error');
        });
    });

    updatePriceAndSummary();
  }

  window.scrollToBooking = function () {
    var mobile = document.querySelector('.booking-widget-mobile [data-booking-widget]');
    var desktop = document.querySelector('.sidebar [data-booking-widget]');
    var target = window.matchMedia('(max-width: 900px)').matches ? mobile : desktop;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    document.querySelectorAll('[data-booking-widget]').forEach(renderWidget);
  });
})();
