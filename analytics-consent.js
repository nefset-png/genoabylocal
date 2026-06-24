(function(){
  var GA_ID='G-5R2CM27F5S';
  var STORAGE_KEY='genoabylocal_analytics_consent';
  var pendingEvents=window.genoaPendingAnalyticsEvents||[];

  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
  window.gtag('consent','default',{
    ad_storage:'denied',
    analytics_storage:'denied',
    ad_user_data:'denied',
    ad_personalization:'denied'
  });

  function getConsent(){
    try{return localStorage.getItem(STORAGE_KEY);}catch(e){return null;}
  }

  function setConsent(value){
    try{localStorage.setItem(STORAGE_KEY,value);}catch(e){}
  }

  function loadAnalytics(){
    if(document.querySelector('script[data-ga-loader]'))return;
    window.gtag('consent','update',{analytics_storage:'granted'});
    window.gtag('js',new Date());
    window.gtag('config',GA_ID);

    var script=document.createElement('script');
    script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+GA_ID;
    script.setAttribute('data-ga-loader','true');
    document.head.appendChild(script);
  }

  function analyticsAllowed(){
    return getConsent()==='accepted';
  }

  function trackEvent(name,params){
    if(!analyticsAllowed()){
      pendingEvents.push({name:name,params:params||{}});
      window.genoaPendingAnalyticsEvents=pendingEvents;
      return;
    }
    loadAnalytics();
    window.gtag('event',name,params||{});
  }

  function flushPendingEvents(){
    if(!analyticsAllowed())return;
    var events=pendingEvents.splice(0,pendingEvents.length);
    window.genoaPendingAnalyticsEvents=pendingEvents;
    events.forEach(function(event){
      trackEvent(event.name,event.params);
    });
  }

  function tourFromPath(path){
    var tours={
      '/tours/genoa-must-see/':{id:'genoa-half',name:'Genoa Highlights & Hidden Corners · Half Day',price:170},
      '/tours/portofino-beyond/':{id:'portofino',name:'Portofino & Beyond',price:490},
      '/tours/cinque-terre-experience/':{id:'cinque',name:'Cinque Terre Day Experience',price:590}
    };
    return tours[path]||null;
  }

  function tourFromBookingUrl(url){
    try{
      var parsed=new URL(url,window.location.origin);
      var id=parsed.searchParams.get('tour')||'genoa-half';
      if(id==='genoa')id='genoa-half';
      var names={'genoa-half':'Genoa Highlights & Hidden Corners · Half Day','genoa-full':'Genoa Highlights & Hidden Corners · Full Day',portofino:'Portofino & Beyond',cinque:'Cinque Terre Day Experience'};
      var prices={'genoa-half':170,'genoa-full':330,portofino:490,cinque:590};
      return {id:id,name:names[id]||id,price:prices[id]||0};
    }catch(e){
      return null;
    }
  }

  function itemParams(tour){
    return {
      currency:'EUR',
      value:tour.price||0,
      items:[{
        item_id:tour.id,
        item_name:tour.name,
        item_category:'tours',
        price:tour.price||0,
        quantity:1
      }]
    };
  }

  function trackPageContext(){
    var path=window.location.pathname;
    var key='genoabylocal_tracked_'+path;
    try{
      if(sessionStorage.getItem(key))return;
      sessionStorage.setItem(key,'1');
    }catch(e){}

    var tour=tourFromPath(path);
    if(tour){
      trackEvent('view_item',itemParams(tour));
    }else if(path==='/booking/'){
      trackEvent('booking_started',Object.assign({
        page_location:window.location.href
      },itemParams(tourFromBookingUrl(window.location.href))));
    }
  }

  function setupAutoClickTracking(){
    document.addEventListener('click',function(event){
      var el=event.target.closest&&event.target.closest('a,button');
      if(!el)return;
      var href=el.getAttribute('href')||'';
      var text=(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,80);

      if(href.indexOf('wa.me/')!==-1){
        trackEvent('generate_lead',{lead_type:'whatsapp',link_text:text,page_location:window.location.href});
        return;
      }

      if(href.indexOf('mailto:')===0){
        trackEvent('generate_lead',{lead_type:'email',link_text:text,page_location:window.location.href});
        return;
      }

      if(href.indexOf('/booking/')!==-1){
        var tour=tourFromBookingUrl(href);
        if(tour){
          trackEvent('select_item',itemParams(tour));
          trackEvent('booking_cta_click',{
            tour_id:tour.id,
            tour_name:tour.name,
            link_text:text,
            page_location:window.location.href
          });
        }
      }
    });
  }

  window.trackGenoaEvent=trackEvent;

  function hideBanner(){
    var banner=document.getElementById('cookie-consent');
    if(banner)banner.remove();
  }

  function showBanner(){
    if(document.getElementById('cookie-consent'))return;

    var style=document.createElement('style');
    style.textContent=
      '#cookie-consent{position:fixed;left:18px;bottom:18px;z-index:9999;max-width:440px;background:#fff;border:1px solid #ece6dd;border-radius:12px;box-shadow:0 18px 48px rgba(23,18,12,.14);padding:14px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;color:#17120c}'+
      '#cookie-consent p{margin:0;font-size:12px;line-height:1.45;color:#7a7268}'+
      '#cookie-consent a{color:#b8935a;text-decoration:none}'+
      '#cookie-consent a:hover{text-decoration:underline}'+
      '#cookie-consent strong{display:block;margin-bottom:2px;font-size:13px;font-weight:750;color:#17120c}'+
      '#cookie-consent .cookie-actions{display:flex;gap:8px;align-items:center}'+
      '#cookie-consent button{border:1px solid #ece6dd;border-radius:8px;background:#fff;color:#17120c;padding:9px 12px;font:inherit;font-size:12px;font-weight:650;cursor:pointer;white-space:nowrap}'+
      '#cookie-consent button[data-accept]{background:#b8935a;border-color:#b8935a;color:#fff}'+
      '@media(max-width:640px){#cookie-consent{grid-template-columns:1fr auto;left:12px;right:12px;bottom:10px;max-width:none;padding:12px}.cookie-actions{flex-direction:column;align-items:stretch}#cookie-consent button{width:92px;padding:8px 10px}}';
    document.head.appendChild(style);

    var banner=document.createElement('div');
    banner.id='cookie-consent';
    banner.innerHTML=
      '<p><strong>Analytics cookies</strong>Optional analytics help improve the booking experience. <a href="/privacy-policy/">Privacy Policy</a></p>'+
      '<div class="cookie-actions"><button type="button" data-decline>Decline</button><button type="button" data-accept>Accept</button></div>';
    document.body.appendChild(banner);

    banner.querySelector('[data-accept]').addEventListener('click',function(){
      setConsent('accepted');
      loadAnalytics();
      flushPendingEvents();
      trackPageContext();
      hideBanner();
    });
    banner.querySelector('[data-decline]').addEventListener('click',function(){
      setConsent('declined');
      pendingEvents.splice(0,pendingEvents.length);
      window.genoaPendingAnalyticsEvents=pendingEvents;
      hideBanner();
    });
  }

  function init(){
    setupAutoClickTracking();
    var consent=getConsent();
    if(consent==='accepted'){
      loadAnalytics();
      flushPendingEvents();
      trackPageContext();
    }else if(consent!=='declined'){
      showBanner();
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();
