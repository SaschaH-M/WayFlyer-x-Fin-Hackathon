// Render all charts for Pretty Fly Deep Dive
(function(){
  var D = window.CHART_DATA || (typeof CHART_DATA !== 'undefined' ? CHART_DATA : null);
  var diag = document.getElementById('diag');
  if (!D || typeof Chart === 'undefined') {
    if (diag) diag.textContent = 'ERROR: ' + (typeof Chart === 'undefined' ? 'Chart.js not loaded' : 'CHART_DATA not found');
    return;
  }
  if (diag) diag.textContent = 'Chart.js loaded. Rendering ' + Object.keys(D).length + ' charts...';

  Chart.defaults.color = '#98989d';
  Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
  Chart.defaults.font.family = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(28,28,30,.95)';
  Chart.defaults.plugins.tooltip.titleFont = {weight:'600',size:13};
  Chart.defaults.plugins.tooltip.bodyFont = {size:12};
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;

  var GC = 'rgba(255,255,255,.04)';
  var SER = ['#0a84ff','#30d158','#ff9f0a','#bf5af2','#ff375f','#5ac8fa','#98989d','#ff6482','#64d2ff','#ffd60a'];
  var charts = [];

  function gbp(v) { return v>=1000 ? '\u00a3'+(v/1000).toFixed(0)+'k' : '\u00a3'+v; }

  function mkLine(id, data, opts) {
    opts = opts || {};
    var ctx = document.getElementById(id);
    if (!ctx) { console.warn('no canvas:',id); return; }
    var ds = data.datasets.map(function(d,i){
      var c = (opts.colors ? opts.colors[i] : SER[i % SER.length]);
      return {
        label: d.label,
        data: d.data.map(function(v){ return v===null ? undefined : v; }),
        borderColor: c,
        backgroundColor: opts.fill ? c+'20' : 'transparent',
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.35,
        fill: opts.fill || false,
        yAxisID: opts.yAxisID || 'y'
      };
    });
    var scales = {
      x: { grid: { color: GC }, ticks: { maxRotation: 45, font: { size: 10 } } },
      y: { grid: { color: GC }, ticks: { callback: gbp } }
    };
    if (opts.y2) {
      scales.y2 = { position: 'right', grid: { display: false }, ticks: { callback: function(v){ return v+'%'; } } };
    }
    var c = new Chart(ctx, {
      type: 'line',
      data: { labels: data.labels, datasets: ds },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { usePointStyle: true, pointStyleWidth: 8, padding: 20, color: '#98989d' } } },
        scales: scales
      }
    });
    charts.push(c);
  }

  function mkBar(id, data, opts) {
    opts = opts || {};
    var ctx = document.getElementById(id);
    if (!ctx) { console.warn('no canvas:',id); return; }
    var ds = data.datasets.map(function(d,i){
      var c = (opts.colors ? opts.colors[i] : SER[i % SER.length]);
      return {
        label: d.label,
        data: d.data,
        backgroundColor: c+'CC',
        borderColor: c,
        borderWidth: 0,
        borderRadius: 4,
        yAxisID: opts.yAxisID || 'y'
      };
    });
    var scales = {
      x: { grid: { color: GC }, ticks: { maxRotation: 45, font: { size: 10 } }, stacked: opts.stacked || false },
      y: { stacked: opts.stacked || false, grid: { color: GC }, ticks: { callback: opts.pct ? function(v){ return v+'%'; } : gbp } }
    };
    if (opts.y2) {
      scales.y2 = { position: 'right', grid: { display: false }, ticks: { callback: function(v){ return v+'%'; } } };
    }
    var c = new Chart(ctx, {
      type: 'bar',
      data: { labels: data.labels, datasets: ds },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { usePointStyle: true, pointStyleWidth: 8, padding: 20, color: '#98989d' } } },
        scales: scales
      }
    });
    charts.push(c);
  }

  function mkPie(id, data) {
    var ctx = document.getElementById(id);
    if (!ctx) { console.warn('no canvas:',id); return; }
    var c = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: data.labels, datasets: [{ data: data.data, backgroundColor: SER.slice(0, data.data.length), borderColor: '#000', borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#98989d', padding: 14, usePointStyle: true, pointStyleWidth: 8, font: { size: 11 } } } }
      }
    });
    charts.push(c);
  }

  function mkMixed(id, dataA, dataB, optsA, optsB) {
    var ctx = document.getElementById(id);
    if (!ctx) { console.warn('no canvas:',id); return; }
    optsA = optsA || {};
    optsB = optsB || {};
    var ds = [
      {
        label: dataA.label,
        data: dataA.data.map(function(v){ return v===null ? undefined : v; }),
        backgroundColor: dataA.backgroundColor || '#ff453aCC',
        borderColor: dataA.borderColor || '#ff453a',
        borderWidth: dataA.borderWidth || 0,
        borderRadius: dataA.borderRadius || 4,
        type: 'bar',
        yAxisID: 'y'
      },
      {
        label: dataB.label,
        data: dataB.data.map(function(v){ return v===null ? undefined : v; }),
        borderColor: dataB.borderColor || '#ff9f0a',
        backgroundColor: dataB.backgroundColor || 'transparent',
        borderWidth: dataB.borderWidth || 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.35,
        type: 'line',
        yAxisID: 'y2'
      }
    ];
    var scales = {
      x: { grid: { color: GC }, ticks: { maxRotation: 45, font: { size: 10 } } },
      y: { grid: { color: GC }, ticks: { callback: optsA.cb || gbp } },
      y2: { position: 'right', grid: { display: false }, ticks: { callback: optsB.cb || function(v){ return v; } } }
    };
    var c = new Chart(ctx, {
      type: 'bar',
      data: { labels: dataA._labels, datasets: ds },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { usePointStyle: true, pointStyleWidth: 8, padding: 20, color: '#98989d' } } },
        scales: scales
      }
    });
    charts.push(c);
  }

  // ======== RENDER ALL CHARTS ========

  // 1: Revenue by product type (stacked bar)
  mkBar('c1', D.chart1_revenue_by_type, {stacked:true});

  // 2: Revenue YoY
  mkLine('c2', D.chart2_revenue_yoy, {colors:['#0a84ff','#5ac8fa','#ff9f0a']});

  // 3: Cash flow
  mkBar('c3', D.chart3_cashflow, {colors:['#30d158','#ff453a','#0a84ff']});

  // 4: Revenue vs Cash
  mkLine('c4', D.chart4_revenue_vs_cash, {colors:['#0a84ff','#30d158']});

  // 5: ROAS
  mkLine('c5', D.chart5_roas, {colors:['#0a84ff','#ff375f']});

  // 5b: Ad spend
  mkBar('c5b', D.chart5b_ad_spend, {colors:['#0a84ff','#ff375f']});

  // 6: Refunds (mixed bar+line)
  (function(){
    var ctx = document.getElementById('c6');
    if (!ctx) return;
    var cb1 = function(v){ return v>=1000 ? '\u00a3'+(v/1000).toFixed(0)+'k' : '\u00a3'+v; };
    var cb2 = function(v){ return v+'%'; };
    var c = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: D.chart6_refunds.labels,
        datasets: [
          { label: 'Refund Amount', data: D.chart6_refunds.datasets[0].data, backgroundColor: '#ff453aCC', borderColor: '#ff453a', borderWidth: 0, borderRadius: 4, yAxisID: 'y', type: 'bar' },
          { label: 'Refund Rate (%)', data: D.chart6_refunds.datasets[1].data, borderColor: '#ff9f0a', backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: 0.35, yAxisID: 'y2', type: 'line' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { usePointStyle: true, pointStyleWidth: 8, padding: 20, color: '#98989d' } } },
        scales: {
          x: { grid: { color: GC }, ticks: { maxRotation: 45, font: { size: 10 } } },
          y: { grid: { color: GC }, ticks: { callback: cb1 } },
          y2: { position: 'right', grid: { display: false }, ticks: { callback: cb2 } }
        }
      }
    });
    charts.push(c);
  })();

  // 6b: Refund reasons (doughnut)
  mkPie('c6b', D.chart6b_refund_reasons);

  // 8: Inventory activity
  mkLine('c8', D.chart8_inventory, {colors:['#bf5af2','#5ac8fa']});

  // 9: Gender segment revenue
  mkBar('c9', D.chart9_gender_segment, {stacked:true,colors:['#0a84ff','#ff375f']});

  // 10: Acquisition sources
  mkBar('c10', D.chart10_acquisition, {stacked:true});

  // 11: Support (mixed bar+line)
  (function(){
    var ctx = document.getElementById('c11');
    if (!ctx) return;
    var c = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: D.chart11_support.labels,
        datasets: [
          { label: 'Tickets', data: D.chart11_support.datasets[0].data, backgroundColor: '#bf5af2CC', borderColor: '#bf5af2', borderWidth: 0, borderRadius: 4, yAxisID: 'y', type: 'bar' },
          { label: 'Avg Resolution (min)', data: D.chart11_support.datasets[1].data, borderColor: '#ff9f0a', backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: 0.35, yAxisID: 'y2', type: 'line' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { usePointStyle: true, pointStyleWidth: 8, padding: 20, color: '#98989d' } } },
        scales: {
          x: { grid: { color: GC }, ticks: { maxRotation: 45, font: { size: 10 } } },
          y: { grid: { color: GC }, ticks: { callback: function(v){ return v; } } },
          y2: { position: 'right', grid: { display: false }, ticks: { callback: function(v){ return v+'m'; } } }
        }
      }
    });
    charts.push(c);
  })();

  // 11b: Bot resolution rate
  mkLine('c11b', D.chart11b_bot_rate, {colors:['#0a84ff'],fill:true});

  // 12: Bank balance
  (function(){
    var ctx = document.getElementById('c12');
    if (!ctx) return;
    var c = new Chart(ctx, {
      type: 'line',
      data: {
        labels: D.chart12_bank_balance.labels,
        datasets: [{
          label: 'Bank Balance',
          data: D.chart12_bank_balance.datasets[0].data,
          borderColor: '#30d158',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: GC }, ticks: { maxTicksLimit: 12, font: { size: 9 }, maxRotation: 45 } },
          y: { grid: { color: GC }, ticks: { callback: gbp } }
        }
      }
    });
    charts.push(c);
  })();

  // 13: AOV by product type
  mkLine('c13', D.chart13_aov_by_type);

  // 14: Discount usage (mixed)
  (function(){
    var ctx = document.getElementById('c14');
    if (!ctx) return;
    var c = new Chart(ctx, {
      type: 'line',
      data: {
        labels: D.chart14_discounts.labels,
        datasets: [
          { label: 'Avg Discount (\u00a3)', data: D.chart14_discounts.datasets[1].data, borderColor: '#ff375f', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.35, yAxisID: 'y' },
          { label: 'Discounted Orders %', data: D.chart14_discounts.datasets[0].data, borderColor: '#ff9f0a', backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: 0.35, yAxisID: 'y2' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { usePointStyle: true, pointStyleWidth: 8, padding: 20, color: '#98989d' } } },
        scales: {
          x: { grid: { color: GC }, ticks: { maxRotation: 45, font: { size: 10 } } },
          y: { grid: { color: GC }, ticks: { callback: function(v){ return '\u00a3'+v; } } },
          y2: { position: 'right', grid: { display: false }, ticks: { callback: function(v){ return v+'%'; } } }
        }
      }
    });
    charts.push(c);
  })();

  // 15: Margins bar
  mkBar('c15', D.chart15_margins, {colors:['#30d158','#5ac8fa','#0a84ff','#bf5af2','#ff9f0a','#ff375f']});

  // 16: Seasonality normalized
  mkLine('c16', D.chart16_seasonality_norm);

  // 17: Revenue vs Balance
  mkLine('c17', D.chart17_revenue_vs_balance, {colors:['#0a84ff','#30d158']});

  if (diag) diag.textContent = 'All 17 charts rendered. ' + charts.length + ' canvases painted.';
})();
